// worker.mjs
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

const connection = new IORedis(redisConnection);
const QUEUE_NAME = process.env.QUEUE_NAME || 'kpi-export-queue';

const queue = new Queue(QUEUE_NAME, { connection });

/**
 * job.data esperado:
 * {
 *   usuarioId: number,
 *   ip?: string,
 *   filters?: object,
 *   format?: string
 * }
 */
const worker = new Worker(
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

    // Crear registro en la tabla kpi_auditoria_export
    // codigoEstado = 0 => encolado/pending
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

    // Actualizamos el progreso del job con el idExport para trazabilidad
    try {
      const queuedJob = await queue.getJob(job.id);
      if (queuedJob) {
        await queuedJob.updateProgress({ idExport: created.idExport });
      }
    } catch (err) {
      // No crítico: si falla la actualización de progreso, lo registramos y seguimos
      console.warn('No se pudo actualizar progreso del job:', err);
    }

    // Retornamos el idExport para que quede en el historial del job
    return { idExport: created.idExport };
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 1),
  }
);

worker.on('completed', (job) => {
  console.log(`Job completado id=${job.id} result=${JSON.stringify(job.returnvalue)}`);
});

worker.on('failed', (job, err) => {
  console.error(`Job fallido id=${job?.id} error=${err?.message}`);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

const shutdown = async () => {
  console.log('Cerrando worker...');
  try {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    await connection.quit();
  } catch (e) {
    console.error('Error durante shutdown:', e);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log(`Worker escuchando cola "${QUEUE_NAME}" (concurrency=${worker.opts.concurrency})`);
