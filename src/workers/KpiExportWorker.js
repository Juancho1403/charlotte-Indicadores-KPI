// worker.mjs
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

let connection = null;
const QUEUE_NAME = process.env.QUEUE_NAME || 'kpi-export-queue';
let queue = null;
let worker = null;

// Start worker lazily to avoid import-time Redis connections
export async function startKpiExportWorker() {
  if (process.env.DISABLE_REDIS === 'true' || process.env.DISABLE_REDIS === '1') {
    console.warn('KpiExportWorker: DISABLE_REDIS active, not starting');
    return null;
  }

  if (worker) return worker;

  try {
    connection = new IORedis(redisConnection);
    queue = new Queue(QUEUE_NAME, { connection });
  } catch (err) {
    console.warn('⚠️ Redis no disponible para KpiExportWorker, funcionalidades de export deshabilitadas:', err && err.message ? err.message : err);
    connection = null;
    queue = null;
    return null;
  }

/**
 * job.data esperado:
 * {
 *   usuarioId: number,
 *   ip?: string,
 *   filters?: object,
 *   format?: string
 * }
 */
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const data = job.data ?? {};
      const usuarioId = Number(data.usuarioId || 0);
      if (!usuarioId || Number.isNaN(usuarioId)) {
        throw new Error('usuarioId inválido en job.data');
      }

      const direccionIP = data.ip ?? null;
      const filtrosAplicados = JSON.stringify(data.filters ?? {});
      const formato = String(data.format ?? 'unknown').slice(0, 10);

      const created = await prisma.kpiAuditoriaExport.create({
        data: {
          usuarioId,
          direccionIP,
          fechaHora: new Date(),
          filtrosAplicados,
          formato,
          codigoEstado: 0,
        },
      });

      try {
        const queuedJob = await queue.getJob(job.id);
        if (queuedJob) await queuedJob.updateProgress({ idExport: created.idExport });
      } catch (err) {
        console.warn('No se pudo actualizar progreso del job:', err);
      }

      return { idExport: created.idExport };
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
    }
  );

  worker.on('completed', (job) => console.log(`Job completado id=${job.id} result=${JSON.stringify(job.returnvalue)}`));
  worker.on('failed', (job, err) => console.error(`Job fallido id=${job?.id} error=${err?.message}`));
  worker.on('error', (err) => console.error('Worker error:', err));

  console.log(`KpiExportWorker escuchando cola "${QUEUE_NAME}"`);
  return worker;
}

export async function shutdownKpiExportWorker() {
  console.log('Cerrando KpiExportWorker...');
  try { if (worker) await worker.close(); } catch (e) { console.error('Error cerrando worker:', e); }
  try { if (queue) await queue.close(); } catch (e) { console.error('Error cerrando queue:', e); }
  try { await prisma.$disconnect(); } catch (e) { console.error('Error desconectando prisma:', e); }
  try { if (connection) await connection.quit(); } catch (e) { console.error('Error quit connection:', e); }
  worker = null;
  queue = null;
  connection = null;
}
