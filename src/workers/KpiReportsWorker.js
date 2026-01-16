// worker.mjs
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { connectRedisIfAvailable } from '../utils/redis.util.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: times => Math.min(times * 50, 2000),
};
let redisConnection = null;
let worker = null;
let disabledBecause = null;

const prisma = new PrismaClient();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET = process.env.S3_BUCKET;
if (!BUCKET) {
  disabledBecause = 'S3_BUCKET no definido';
  console.error('⚠️ KpiReportsWorker deshabilitado: S3_BUCKET no definido');
}

const PRESIGNED_EXPIRES = Number(process.env.PRESIGNED_EXPIRES || 3600); // segundos
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const BATCH_SIZE = Number(process.env.BATCH_SIZE || 1000);

// Subir stream a S3 usando multipart upload (no disco)
async function uploadStreamToS3(key, stream, contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
  });
  return upload.done();
}

// Paginador por idLog para KpiSnapshotDiario (evita OOM)
async function* paginateKpiSnapshots(batchSize = BATCH_SIZE, filter = {}) {
  let lastId = null;
  while (true) {
    const where = lastId ? { ...filter, idLog: { gt: lastId } } : filter;
    const rows = await prisma.kpiSnapshotDiario.findMany({
      where,
      orderBy: { idLog: 'asc' },
      take: batchSize,
    });
    if (!rows || rows.length === 0) break;
    for (const r of rows) yield r;
    lastId = rows[rows.length - 1].idLog;
    if (rows.length < batchSize) break;
  }
}

// Processor del worker
async function processor(job) {
  const jobId = job.id;
  const { filter = {}, reportMeta = {} } = job.data || {};

  // Key único en S3
  const key = `reports/report-${jobId}-${Date.now()}.xlsx`;

  // Stream intermedio
  const pass = new PassThrough();

  // Workbook streaming
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: true });

  // Hoja y columnas (ajusta si necesitas otros nombres/orden)
  const sheet = workbook.addWorksheet('KPI Diario');
  sheet.columns = [
    { header: 'id_log', key: 'idLog', width: 12 },
    { header: 'fecha_corte', key: 'fechaCorte', width: 15 },
    { header: 'total_ventas', key: 'totalVentas', width: 15 },
    { header: 'total_pedidos', key: 'totalPedidos', width: 12 },
    { header: 'tiempo_promedio_min', key: 'tiempoPromedioMin', width: 18 },
    { header: 'rotacion_mesas_indice', key: 'rotacionMesasIndice', width: 18 },
    { header: 'ticket_promedio', key: 'ticketPromedio', width: 15 },
    { header: 'alertas_generadas', key: 'alertasGeneradas', width: 15 },
    { header: 'metadata_json', key: 'metadataJson', width: 40 },
    { header: 'created_at', key: 'createdAt', width: 20 },
  ];

  // Iniciar subida a S3 en paralelo (consume el pass stream)
  const uploadPromise = uploadStreamToS3(key, pass);

  try {
    // Iterar registros en bloques y escribir filas en streaming
    for await (const row of paginateKpiSnapshots(BATCH_SIZE, filter)) {
      // Conversión segura de tipos:
      const totalVentas = row.totalVentas != null ? String(row.totalVentas) : '';
      const tiempoPromedioMin = row.tiempoPromedioMin != null ? String(row.tiempoPromedioMin) : '';
      const rotacionMesasIndice = row.rotacionMesasIndice != null ? String(row.rotacionMesasIndice) : '';
      const ticketPromedio = row.ticketPromedio != null ? String(row.ticketPromedio) : '';
      const metadataJson = row.metadataJson != null ? JSON.stringify(row.metadataJson) : '';

      sheet.addRow({
        idLog: row.idLog != null ? String(row.idLog) : '',
        fechaCorte: row.fechaCorte ? (row.fechaCorte instanceof Date ? row.fechaCorte.toISOString().slice(0,10) : String(row.fechaCorte)) : '',
        totalVentas,
        totalPedidos: row.totalPedidos ?? '',
        tiempoPromedioMin,
        rotacionMesasIndice,
        ticketPromedio,
        alertasGeneradas: row.alertasGeneradas ?? '',
        metadataJson,
        createdAt: row.createdAt ? (row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)) : '',
      }).commit();
    }

    // Finalizar workbook (esto cierra el stream cuando exceljs termina)
    await workbook.commit();

    // Esperar a que la subida a S3 termine
    await uploadPromise;

    // Generar presigned URL
    const getCmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const presignedUrl = await getSignedUrl(s3Client, getCmd, { expiresIn: PRESIGNED_EXPIRES });

    const expiresAt = new Date(Date.now() + PRESIGNED_EXPIRES * 1000);

    // Guardar metadata en tabla report (ajusta si tu tabla tiene otro nombre/estructura)
    try {
      await prisma.report.upsert({
        where: { jobId: String(jobId) },
        update: {
          s3Key: key,
          downloadUrl: presignedUrl,
          expiresAt,
          status: 'READY',
          updatedAt: new Date(),
        },
        create: {
          jobId: String(jobId),
          s3Key: key,
          downloadUrl: presignedUrl,
          expiresAt,
          status: 'READY',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } catch (dbErr) {
      // No abortamos si falla el upsert, pero lo registramos
      console.warn('Warning: no se pudo persistir metadata en tabla report:', dbErr);
    }

    // Actualizar job.data con download_url (opcional)
    try {
      await job.update({ ...job.data, download_url: presignedUrl, expires_at: expiresAt.toISOString() });
    } catch (updErr) {
      console.warn('Warning: no se pudo actualizar job.data con download_url:', updErr);
    }

    return { success: true, download_url: presignedUrl, s3Key: key };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error(`Error en job ${jobId}:`, message);

    // Intentar mover job a FAILED con mensaje
    try {
      await job.moveToFailed({ message }, true);
    } catch (moveErr) {
      console.error('Error moviendo job a FAILED:', moveErr);
      // Si moveToFailed falla, relanzamos para que Bull marque el job como failed
      throw new Error(`Error al mover job a FAILED: ${message}; moveErr: ${String(moveErr)}`);
    }

    // Registrar fallo en tabla report si existe
    try {
      await prisma.report.upsert({
        where: { jobId: String(jobId) },
        update: { status: 'FAILED', errorMessage: message, updatedAt: new Date() },
        create: { jobId: String(jobId), status: 'FAILED', errorMessage: message, createdAt: new Date(), updatedAt: new Date() },
      });
    } catch (dbErr) {
      console.error('Error guardando estado FAILED en DB:', dbErr);
    }

    // Re-lanzar para asegurar que el worker finalice con error si es necesario
    throw err;
  }
}

// Crear worker solo si Redis está disponible
async function startKpiReportsWorker() {
  if (disabledBecause) {
    console.warn('KpiReportsWorker no arrancado:', disabledBecause);
    return;
  }

  if (process.env.DISABLE_REDIS === 'true' || process.env.DISABLE_REDIS === '1') {
    console.warn('KpiReportsWorker no arrancado: DISABLE_REDIS activo');
    return;
  }

  if (worker) return; // already started

  try {
    redisConnection = await connectRedisIfAvailable(REDIS_URL, redisOptions, 800);
    if (!redisConnection) {
      console.warn('⚠️ KpiReportsWorker: Redis no disponible (timeout), worker no arrancado');
      return;
    }
  } catch (err) {
    console.warn('⚠️ No se pudo crear conexión a Redis en KpiReportsWorker:', err && err.message ? err.message : err);
    redisConnection = null;
    return;
  }

  try {
    worker = new Worker('reports-queue', processor, { connection: redisConnection, concurrency: WORKER_CONCURRENCY });

    worker.on('completed', (job) => console.log(`Job ${job.id} completado`));
    worker.on('failed', (job, err) => console.error(`Job ${job?.id} falló:`, err?.message ?? err));
  } catch (err) {
    console.warn('⚠️ No se pudo inicializar Worker reports-queue:', err && err.message ? err.message : err);
    worker = null;
  }
}

async function shutdownKpiReportsWorker() {
  try {
    if (worker) {
      await worker.close();
      worker = null;
    }
  } catch (e) { /* ignore */ }

  try { if (redisConnection) await redisConnection.quit(); } catch (e) { /* ignore */ }
  redisConnection = null;
  try { await prisma.$disconnect(); } catch (e) { /* ignore */ }
}

// Cierre limpio
export { startKpiReportsWorker, shutdownKpiReportsWorker };
