// kpiWorker.mjs
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import pkg from '@prisma/client';
const { PrismaClient, KpiMetricType, KpiSeverity } = pkg;

const prisma = new PrismaClient();

const redisOptions = {
  maxRetriesPerRequest: null,            // obligatorio para BullMQ
  enableReadyCheck: true,
  retryStrategy: times => Math.min(times * 50, 2000),
};

// Lazy resources (no connect on import)
let connection = null;
let queue = null;
let worker = null;
const queueName = process.env.KPI_QUEUE_NAME || 'kpi-check-queue';

// Endpoints (leer desde env)
const CLIENTS_URL = process.env.CLIENTS_URL || 'http://localhost:3000/clients';
const SERVICE_REQUESTS_URL = process.env.SERVICE_REQUESTS_URL || 'http://localhost:3000/service-requests';

// KPI_CRON: por defecto '*/1 * * * *'
const KPI_CRON = process.env.KPI_CRON || '*/1 * * * *';

// Mapea claves de thresholds a tipos y cómo extraer el valor
const METRIC_KEYS = {
  USUARIOS: {
    metricKey: 'USUARIOS',
    prismaMetric: KpiMetricType.TIEMPO,
    extractValue: (clientsResponse) => {
      if (!clientsResponse || !clientsResponse.data) return 0;
      return (clientsResponse.meta && typeof clientsResponse.meta.total === 'number')
        ? clientsResponse.meta.total
        : clientsResponse.data.length;
    },
    itemLabel: (val) => `Usuarios: ${val}`
  },
  VENTAS: {
    metricKey: 'VENTAS',
    prismaMetric: KpiMetricType.VENTAS,
    extractValue: (clientsResponse) => {
      if (!clientsResponse || !clientsResponse.data) return 0;
      if (clientsResponse.meta && typeof clientsResponse.meta.total_sales_in_page === 'number') {
        return Number(clientsResponse.meta.total_sales_in_page);
      }
      return clientsResponse.data.reduce((s, c) => s + (Number(c.total_amount) || 0), 0);
    },
    itemLabel: (val) => `Ventas: ${val}`
  },
  ROTACION: {
    metricKey: 'ROTACION',
    prismaMetric: KpiMetricType.ROTACION,
    extractValue: (clientsResponse) => {
      if (!clientsResponse || !clientsResponse.data) return 0;
      const arr = clientsResponse.data
        .map(c => c.kpi_data && c.kpi_data.stay_duration_minutes)
        .filter(v => typeof v === 'number');
      if (arr.length === 0) return 0;
      return Math.round(arr.reduce((a,b)=>a+b,0) / arr.length);
    },
    itemLabel: (val) => `Rotación (min promedio): ${val}`
  },
  TIEMPO_ESPERA: {
    metricKey: 'TIEMPO_ESPERA',
    prismaMetric: KpiMetricType.TIEMPO,
    extractValue: (serviceResponse) => {
      if (!serviceResponse || !serviceResponse.data) return 0;
      const arr = serviceResponse.data
        .map(s => s.metrics && s.metrics.elapsed_minutes)
        .filter(v => typeof v === 'number');
      if (arr.length === 0) return 0;
      return Math.max(...arr);
    },
    itemLabel: (val) => `Tiempo espera (min): ${val}`
  }
};

// Cargar thresholds desde DB
async function loadThresholds() {
  const rows = await prisma.kpiThresholdsHistorial.findMany();
  const map = {};
  for (const r of rows) {
    // r.tipoMetrica o r.metric_key según cómo lo guardes
    const key = r.tipoMetrica ?? r.metric_key ?? r.tipoMetrica;
    map[key] = {
      value_warning: Number(r.valorAlerta ?? r.value_warning ?? 0),
      value_critical: Number(r.valorCritico ?? r.value_critical ?? 0),
      timestamp: r.fechaCambio ?? r.timestamp_creacion ?? null
    };
  }
  return map;
}

// Decide severidad
function decideSeverity(value, threshold) {
  if (!threshold) return null;
  const crit = Number(threshold.value_critical || 0);
  const warn = Number(threshold.value_warning || 0);
  if (crit && value >= crit) return KpiSeverity.CRITICAL;
  if (warn && value >= warn) return KpiSeverity.WARNING;
  return null;
}

// Dedupe: evita crear la misma alerta en la última hora
async function recentSimilarAlertExists(prismaMetric, itemAfectado, severity) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const existing = await prisma.kpiAlertaHistorial.findFirst({
    where: {
      tipoIncidencia: prismaMetric,
      itemAfectado,
      severidad: severity,
      timestampCreacion: { gte: oneHourAgo }
    }
  });
  return !!existing;
}

// Crear alerta
async function createAlert(prismaMetric, itemAfectado, valorRegistrado, severity) {
  const exists = await recentSimilarAlertExists(prismaMetric, itemAfectado, severity);
  if (exists) {
    console.log('Alerta similar reciente existe, se omite:', prismaMetric, itemAfectado, severity);
    return null;
  }

  const alert = await prisma.kpiAlertaHistorial.create({
    data: {
      tipoIncidencia: prismaMetric,
      itemAfectado,
      valorRegistrado: String(valorRegistrado),
      severidad: severity
      // estadoGestion por defecto "PENDIENTE"
    }
  });
  console.log('Alerta creada id:', alert.idAlerta ?? alert.id_alerta ?? alert.id);
  return alert;
}

// Lógica principal
async function runKpiCheck() {
  try {
    const thresholds = await loadThresholds();

    // Usar fetch nativo (Node 18+). Si tu runtime no soporta fetch, instala 'node-fetch' y adapta.
    const fetchWithTimeout = async (url, timeout = 8000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return await res.json();
      } catch (err) {
        clearTimeout(id);
        throw err;
      }
    };

    const clientsPromise = fetchWithTimeout(CLIENTS_URL).catch(err => {
      console.error('Error fetching clients:', err.message || err);
      return null;
    });
    const servicesPromise = fetchWithTimeout(SERVICE_REQUESTS_URL).catch(err => {
      console.error('Error fetching service-requests:', err.message || err);
      return null;
    });

    const [clientsResponse, serviceResponse] = await Promise.all([clientsPromise, servicesPromise]);

    for (const keyName of Object.keys(METRIC_KEYS)) {
      const cfg = METRIC_KEYS[keyName];
      let value = 0;
      if (keyName === 'TIEMPO_ESPERA') {
        value = cfg.extractValue(serviceResponse);
      } else {
        value = cfg.extractValue(clientsResponse);
      }

      const threshold = thresholds[cfg.metricKey] || thresholds[keyName];
      const severity = decideSeverity(value, threshold);

      if (severity) {
        const itemLabel = cfg.itemLabel(value);
        await createAlert(cfg.prismaMetric, itemLabel, value, severity);
      } else {
        console.log(`Métrica ${keyName} OK (valor=${value})`);
      }
    }
  } catch (err) {
    console.error('Error en runKpiCheck:', err);
  }
}

// Worker will be created when startKpiWorker is called. This avoids connecting on import.

// Scheduler interno basado en KPI_CRON (soporta expresiones del tipo "*/N * * * *")
function cronToIntervalMs(cronExpr) {
  // Soporta únicamente el patrón "*/N * * * *" (cada N minutos)
  const m = cronExpr.trim().match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
  if (m) {
    const minutes = Number(m[1]);
    if (minutes > 0) return minutes * 60_000;
  }
  // fallback a KPI_INTERVAL_MS o 1 minuto
  const fallback = Number(process.env.KPI_INTERVAL_MS || 60_000);
  return fallback;
}

const intervalMs = cronToIntervalMs(KPI_CRON);
let intervalHandle = null;

async function startInternalScheduler() {
  try {
    // Encolar inmediatamente
    await queue.add('kpi-check', { triggeredBy: 'internal-scheduler', ts: Date.now() }, { removeOnComplete: true, removeOnFail: false });
    console.log('Job inicial encolado por internal scheduler');
  } catch (e) {
    console.error('Error al encolar job inicial:', e);
  }

  intervalHandle = setInterval(async () => {
    try {
      await queue.add('kpi-check', { triggeredBy: 'internal-scheduler', ts: Date.now() }, { removeOnComplete: true, removeOnFail: false });
      console.log('Job encolado por internal scheduler (interval ms):', intervalMs);
    } catch (e) {
      console.error('Error al encolar job repetido:', e);
    }
  }, intervalMs);
}

// exportar funciones para controlar el worker desde index.js
export async function startKpiWorker() {
  // inicializa conexión Redis, cola y worker de forma perezosa
  const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log('Iniciando KPI worker');
  console.log('REDIS_URL:', REDIS_URL);
  console.log('CLIENTS_URL:', CLIENTS_URL);
  console.log('SERVICE_REQUESTS_URL:', SERVICE_REQUESTS_URL);
  console.log('KPI_CRON:', KPI_CRON, '=> intervalMs:', intervalMs);

  try {
    connection = new IORedis(REDIS_URL, redisOptions);
    queue = new Queue(queueName, { connection });

    worker = new Worker(queueName, async job => {
      console.log('Procesando job', job.id, 'data:', job.data);
      await runKpiCheck();
    }, { connection });

    worker.on('completed', job => {
      console.log(`Job ${job.id} completado`);
    });
    worker.on('failed', (job, err) => {
      console.error(`Job ${job.id} falló:`, err);
    });

    await startInternalScheduler();
    return { worker, queue, connection };
  } catch (err) {
    console.warn('⚠️ Redis no disponible para KpiAlertWorker, desactivando worker:', err && err.message ? err.message : err);
    connection = null;
    queue = null;
    worker = null;
    return null;
  }
}

export async function shutdownKpiWorker() {
  console.log('Apagando KPI worker');
  if (intervalHandle) clearInterval(intervalHandle);
  try { if (worker) await worker.close(); } catch (e) { /* ignore */ }
  try { if (queue) await queue.close(); } catch (e) { /* ignore */ }
  try { await prisma.$disconnect(); } catch (e) { /* ignore */ }
  try { if (connection) await connection.quit(); } catch (e) { /* ignore */ }
}
