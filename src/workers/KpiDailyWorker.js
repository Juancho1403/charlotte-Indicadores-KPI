import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import logger from '../utils/logger.js';

// Import Services
import { AtencionClienteService } from '../services/AtencionClienteService.js';
import { DeliveryService } from '../services/DeliveryService.js';
import { KitchenService } from '../services/KitchenService.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: times => Math.min(times * 50, 2000),
};

const prisma = new PrismaClient();

let connection = null;
let queue = null;
let worker = null;
const QUEUE_NAME = 'kpi-daily';

const OUTLIER_K = Number(process.env.OUTLIER_K) || 2;
const OUTLIER_STRATEGY = (process.env.OUTLIER_STRATEGY === 'exclude') ? 'exclude' : 'adjust';
const CRON_EXPRESSION = process.env.KPI_CRON || '0 2 * * *';
const CRON_TIMEZONE = process.env.KPI_CRON_TZ || 'America/Caracas';

// Inicializar servicios
const atencionClienteService = new AtencionClienteService();
const deliveryService = new DeliveryService();
const kitchenService = new KitchenService();

async function initQueueAndWorker() {
  if (queue) return { connection, queue, worker };
  try {
    connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', redisOptions);
    queue = new Queue(QUEUE_NAME, { connection });
  } catch (err) {
    console.warn('⚠️ Redis no disponible, funcionalidad deshabilitada:', err?.message);
    connection = null;
    queue = null;
    worker = null;
  }
  return { connection, queue, worker };
}

async function scheduleDailyKpiJob() {
  const ctx = await initQueueAndWorker();
  if (!ctx.queue) {
    console.warn('No se pudo programar job diario: cola Redis no inicializada.');
    return null;
  }
  await ctx.queue.add(
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
  console.log('📅 Job KpiDailyWorker programado:', CRON_EXPRESSION);
}

function median(values) {
  const arr = [...values].sort((a,b) => a-b);
  const n = arr.length;
  if (n === 0) return 0;
  const mid = Math.floor(n/2);
  return (n % 2 === 0) ? (arr[mid-1] + arr[mid]) / 2 : arr[mid];
}

export async function startKpiDailyWorker() {
  if (String(process.env.DISABLE_REDIS || '').toLowerCase() === 'true') {
    return null;
  }

  const ctx = await initQueueAndWorker();
  if (!ctx.connection || !ctx.queue) {
    return null;
  }
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAME,
    async job => {
      try {
        const now = dayjs().tz(CRON_TIMEZONE);
        const targetDay = now.subtract(1, 'day').startOf('day');
        const startIso = targetDay.toISOString();
        const endIso = targetDay.endOf('day').toISOString();
        const targetDate = targetDay.toDate();

        console.log(`[KPI] Iniciando cálculo diario para: ${targetDay.format('YYYY-MM-DD')}`);

        // 1. Obtener datos de Delivery (Ventas y Pedidos)
        // Usamos Delivery como fuente de verdad para ventas
        let orders = [];
        try {
          // Nota: getOrders debe soportar filtrado por fecha
          const ordersResp = await deliveryService.getOrders({
            dateFrom: startIso,
            dateTo: endIso,
            status: 'COMPLETED' // Solo completadas para ingresos reales
          });
          orders = ordersResp.data || [];
        } catch (e) {
          logger.error('[KPI] Error fetching orders:', e);
        }

        // 2. Obtener datos de Atención al Cliente (Mesas y Clientes)
        let clients = [];
        try {
          const clientsResp = await atencionClienteService.getClientes({
            dateFrom: startIso,
            dateTo: endIso
          });
          clients = clientsResp.data || [];
        } catch (e) {
             logger.error('[KPI] Error fetching clients:', e);
        }

        // 3. Obtener datos de Cocina (Tiempos)
        // Usamos KDS History para tiempos de preparación
        let kdsHistory = [];
        try {
            const kdsResp = await kitchenService.getKdsHistory({
                dateFrom: startIso,
                dateTo: endIso,
                status: 'COMPLETED'
            });
            kdsHistory = kdsResp.data || [];
        } catch (e) {
            logger.error('[KPI] Error fetching KDS history:', e);
        }

        if (orders.length === 0 && clients.length === 0 && kdsHistory.length === 0) {
             console.log('[KPI] Sin datos para el día, creando snapshot vacío.');
             // Crear snapshot vacío
             await prisma.kpiSnapshotDiario.create({
                data: {
                  fechaCorte: targetDate,
                  totalVentas: 0,
                  totalPedidos: 0,
                  tiempoPromedioMin: 0,
                  rotacionMesasIndice: 0,
                  ticketPromedio: 0,
                  alertasGeneradas: 0,
                  metadataJson: { note: 'no_data' }
                }
             });
             return;
        }

        // --- Cálculos ---

        // Ventas
        const totalVentas = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
        const totalPedidos = orders.length;
        const ticketPromedio = totalPedidos > 0 ? totalVentas / totalPedidos : 0;

        // Tiempos (Cocina o Delivery)
        // Priorizamos tiempos de cocina si hay datos, o calculamos delivery time
        let avgServiceMin = 0;
        if (kdsHistory.length > 0) {
            const totalMinutes = kdsHistory.reduce((acc, item) => {
                const s = new Date(item.startedAt || item.createdAt);
                const e = new Date(item.completedAt || item.finishedAt);
                return acc + ((e - s) / 60000);
            }, 0);
            avgServiceMin = totalMinutes / kdsHistory.length;
        }

        // Rotación de Mesas
        // Aproximación: Total clientes atendidos / Mesas totales (o únicas usadas)
        // Como no tenemos "total mesas físicas", usamos unique tables en los clientes del día
        const uniqueTables = new Set(clients.map(c => c.tableId).filter(Boolean));
        const rotacionMesasIndice = uniqueTables.size > 0 ? (clients.length / uniqueTables.size) : 0;
        
        // Guardar Snapshot
        await prisma.kpiSnapshotDiario.upsert({
            where: { fechaCorte: targetDate },
            update: {
                totalVentas: totalVentas,
                totalPedidos: totalPedidos,
                tiempoPromedioMin: avgServiceMin,
                rotacionMesasIndice: rotacionMesasIndice,
                ticketPromedio: ticketPromedio,
                metadataJson: {
                    source: 'automated_worker',
                    counts: {
                        orders: orders.length,
                        clients: clients.length,
                        kdsTasks: kdsHistory.length
                    }
                }
            },
            create: {
                fechaCorte: targetDate,
                totalVentas: totalVentas,
                totalPedidos: totalPedidos,
                tiempoPromedioMin: avgServiceMin,
                rotacionMesasIndice: rotacionMesasIndice,
                ticketPromedio: ticketPromedio,
                metadataJson: {
                    source: 'automated_worker',
                    counts: {
                        orders: orders.length,
                        clients: clients.length,
                        kdsTasks: kdsHistory.length
                    }
                }
            }
        });

        console.log(`[KPI] Snapshot guardado exitosamente. Ventas: ${totalVentas}, Pedidos: ${totalPedidos}`);
      } catch (err) {
        console.error('[KPI] Error en job diario:', err);
        throw err;
      }
    },
    {
      connection: ctx.connection,
      concurrency: 1,
      autorun: true,
    }
  );

  return worker;
}

export async function shutdownKpiDailyWorker() {
  try { if (worker) await worker.close(); } catch (e) { console.error('Error cerrando worker:', e); }
  try { if (queue) await queue.close(); } catch (e) {}
  try { if (connection) await connection.quit(); } catch (e) {}
  try { await prisma.$disconnect(); } catch (e) {}
  worker = null; queue = null; connection = null;
}

export default scheduleDailyKpiJob;
