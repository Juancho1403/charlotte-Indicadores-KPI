import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import logger from '../utils/logger.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const redisOptions = {
  maxRetriesPerRequest: null,            // obligatorio para BullMQ
  enableReadyCheck: true,                
  retryStrategy: times => Math.min(times * 50, 2000),
};

const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', redisOptions);

const QUEUE_NAME = 'kpi-daily';
const queue = new Queue(QUEUE_NAME, { connection });

// Configuración por ENV
const OUTLIER_K = Number(process.env.OUTLIER_K) || 2;
const OUTLIER_STRATEGY = (process.env.OUTLIER_STRATEGY === 'exclude') ? 'exclude' : 'adjust';
const CRON_EXPRESSION = process.env.KPI_CRON || '0 2 * * *';
const CRON_TIMEZONE = process.env.KPI_CRON_TZ || 'America/Caracas';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || null; // opcional

// Programa job repetido 
async function scheduleDailyKpiJob() {
  await queue.add(
    'calculate-daily-kpi',
    {},
    {
      removeOnComplete: true,
      removeOnFail: false,
      repeat: {
        cron: CRON_EXPRESSION,
        tz: CRON_TIMEZONE,
      },
    }
  );
}

function median(values) {
  const arr = [...values].sort((a,b) => a-b);
  const n = arr.length;
  if (n === 0) return 0;
  const mid = Math.floor(n/2);
  return (n % 2 === 0) ? (arr[mid-1] + arr[mid]) / 2 : arr[mid];
}

function quantile(values, q) {
  const arr = [...values].sort((a,b) => a-b);
  if (!arr.length) return 0;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
  return arr[base];
}

function handleOutliers(valuesInput, k = 2, strategy = 'adjust') {
  // normalizar a números y filtrar no-numéricos
  const values = Array.isArray(valuesInput) ? valuesInput.map(v => Number(v)).filter(v => isFinite(v)) : [];
  if (!values.length) {
    return { processed: [], outliersCount: 0, mu: 0, sd: 0, lower: 0, upper: 0 };
  }

  // Fallback robusto para muestras pequeñas
  if (values.length < 4) {
    const med = median(values);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const ratioThreshold = 10; // configurable
    let outliersCount = 0;

    const processed = values
      .map(v => {
        // si med == 0, evitamos división por cero; en ese caso no marcamos por ratio
        if (med > 0 && (v / med) >= ratioThreshold) {
          outliersCount++;
          if (strategy === 'exclude') return null;
          if (strategy === 'adjust') return med * ratioThreshold;
        }
        if (med > 0 && (med / (v || 1)) >= ratioThreshold) {
          outliersCount++;
          if (strategy === 'exclude') return null;
          if (strategy === 'adjust') return med / ratioThreshold;
        }
        return v;
      })
      .filter(v => v !== null);

    return { processed, outliersCount, mu: med, sd: 0, lower: min, upper: max };
  }

  // Para muestras >= 4 usamos IQR
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr * k;
  const upper = q3 + 1.5 * iqr * k;

  let outliersCount = 0;
  const processed = values
    .map(v => {
      if (v < lower || v > upper) {
        outliersCount++;
        if (strategy === 'exclude') return null;
        if (strategy === 'adjust') return Math.max(lower, Math.min(upper, v));
      }
      return v;
    })
    .filter(v => v !== null);

  const mu = median(values);
  const sd = quantile(values, mu);

  return { processed, outliersCount, mu, sd, lower, upper };
}

// Helper fetch wrapper (usa global fetch)
async function fetchJson(path, params = {}) {
  const url = new URL(path, API_BASE);
  if (params.query) {
    Object.entries(params.query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const headers = { 'Content-Type': 'application/json' };
  if (API_AUTH_TOKEN) headers['Authorization'] = `Bearer ${API_AUTH_TOKEN}`;

  const res = await fetch(url.toString(), { method: 'GET', headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Fetch error ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// Worker: lógica del job
const worker = new Worker(
  QUEUE_NAME,
  async job => {
    try {
      const now = dayjs().tz(CRON_TIMEZONE);
      const targetDay = now.subtract(1, 'day').startOf('day');
      const start = targetDay.toDate();
      const end = targetDay.endOf('day').toDate();

      const startIso = targetDay.toISOString();
      const endIso = targetDay.endOf('day').toISOString();

      // Obtener /clients y /comandas desde la API
      let clients = [];
      let comandas = [];

      try {
        const clientsResp = await fetchJson('/clients', { query: { start: startIso, end: endIso } });
        clients = Array.isArray(clientsResp?.data) ? clientsResp.data : [];
      } catch (e) {
        logger.logFetchWarning('/clients', e.status || 'network', e.message);
        clients = [];
      }

      try {
        const comandasResp = await fetchJson('/comandas', { query: { start: startIso, end: endIso } });
        comandas = Array.isArray(comandasResp?.data) ? comandasResp.data : [];
      } catch (e) {
        logger.logFetchWarning('/comandas', e.status || 'network', e.message);
        comandas = [];
      }

      // Filtrar clientes cerrados en el rango
      const closedClients = clients.filter(c => c.status === 'CLOSED' && c.closed_at);

      if (!closedClients.length && !comandas.length) {
        logger.info('No data for target day', { start, end });
        await prisma.kpiSnapshotDiario.create({
          data: {
            fechaCorte: targetDay.toDate(),
            totalVentas: '0.00',
            totalPedidos: 0,
            tiempoPromedioMin: '0.00',
            rotacionMesasIndice: '0.00',
            ticketPromedio: '0.00',
            alertasGeneradas: 0,
            metadataJson: {
              note: 'no_data',
              dateRange: { start, end },
            },
          },
        });
        return;
      }

      // --- Ingresos ---
      const revenues = closedClients
        .map(c => {
          const v = Number(c.total_amount ?? 0);
          return isNaN(v) ? 0 : v;
        })
        .filter(v => v >= 0);

      // --- Service times (ms) ---
      const serviceTimesMs = [];
      comandas.forEach(cmd => {
        const m = cmd.metrics || {};
        if (typeof m.service_time_minutes === 'number') {
          serviceTimesMs.push(m.service_time_minutes * 60000);
        } else if (typeof m.elapsed_minutes === 'number') {
          serviceTimesMs.push(m.elapsed_minutes * 60000);
        } else if (cmd.sent_at && cmd.delivered_at) {
          const sent = new Date(cmd.sent_at).getTime();
          const delivered = new Date(cmd.delivered_at).getTime();
          if (!isNaN(sent) && !isNaN(delivered) && delivered >= sent) {
            serviceTimesMs.push(delivered - sent);
          }
        }
      });

      // --- Rotación de mesas ---
      const tableIdsFromComandas = new Set(comandas.map(c => c.table_number).filter(Boolean));
      const tableIdsFromClients = new Set(closedClients.map(c => c.tableId || c.table_number).filter(Boolean));
      const distinctTables = new Set([...tableIdsFromComandas, ...tableIdsFromClients]);
      const tableRotations = closedClients.length || comandas.length;
      const distinctTablesCount = distinctTables.size || 1;
      const rotacionMesasIndice = tableRotations / distinctTablesCount;

      // --- Outliers ---
      const revenueOut = handleOutliers(revenues, OUTLIER_K, OUTLIER_STRATEGY);
      const serviceOut = handleOutliers(serviceTimesMs, OUTLIER_K, OUTLIER_STRATEGY);

      // --- Cálculos finales ---
      const totalRevenue = revenueOut.processed.reduce((a, b) => a + b, 0);
      if (!isFinite(totalRevenue) || isNaN(totalRevenue)) {
        logger.logUnexpectedValue('totalRevenue calculation', totalRevenue, 'finite number >= 0');
      }
      const totalPedidos = revenueOut.processed.length;
      const avgServiceMs = serviceOut.processed.length ? median(serviceOut.processed) : 0;
      const avgServiceMin = avgServiceMs / 60000;
      const ticketPromedio = totalPedidos ? totalRevenue / totalPedidos : 0;
      const outliersCount = revenueOut.outliersCount + serviceOut.outliersCount;
      if (outliersCount > Math.max(5, Math.floor(revenues.length * 0.1))) {
        logger.logOutlierSummary(targetDay.format('YYYY-MM-DD'), revenueOut, serviceOut, outliersCount);
      }

      const metadata = {
        dateRange: { start, end },
        outlierConfig: { k: OUTLIER_K, strategy: OUTLIER_STRATEGY },
        revenueStats: {
          rawCount: revenues.length,
          processedCount: revenueOut.processed.length,
          mu: revenueOut.mu,
          sd: revenueOut.sd,
          lower: revenueOut.lower,
          upper: revenueOut.upper,
        },
        serviceStats: {
          rawCount: serviceTimesMs.length,
          processedCount: serviceOut.processed.length,
          muMs: serviceOut.mu,
          sdMs: serviceOut.sd,
          lowerMs: serviceOut.lower,
          upperMs: serviceOut.upper,
        },
        tables: {
          distinctTables: Array.from(distinctTables).slice(0, 50),
          distinctTablesCount,
        },
        sourceCounts: {
          clients: closedClients.length,
          comandas: comandas.length
        }
      };

      // Guardar snapshot
      await prisma.kpiSnapshotDiario.create({
        data: {
          fechaCorte: targetDay.toDate(),
          totalVentas: totalRevenue.toFixed(2),
          totalPedidos: totalPedidos,
          tiempoPromedioMin: avgServiceMin.toFixed(2),
          rotacionMesasIndice: rotacionMesasIndice.toFixed(2),
          ticketPromedio: ticketPromedio.toFixed(2),
          alertasGeneradas: outliersCount,
          metadataJson: metadata,
        },
      });

      console.log(`[KPI] Snapshot guardado para ${targetDay.format('YYYY-MM-DD')}: ventas=${totalRevenue.toFixed(2)}, pedidos=${totalPedidos}`);
    } catch (err) {
      console.error('[KPI] Error en job:', err);
      throw err;
    }
  },
  {
    connection,
    concurrency: 1,
    autorun: true,
  }
);

worker.on('completed', job => console.log(`Job ${job.id} completado`));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} falló:`, err));

export default scheduleDailyKpiJob;
