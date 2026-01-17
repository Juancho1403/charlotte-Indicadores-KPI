import { Worker } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { envs } from '../config/envs.js'; // Las variables que configuramos
import IORedis from 'ioredis';
import { prisma } from '../db/client.js';
import { connectRedisIfAvailable } from '../utils/redis.util.js';

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: times => Math.min(times * 50, 2000),
};

// 1. Configurar Cliente AWS S3
const s3Client = new S3Client({
  region: envs.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: envs.AWS_ACCESS_KEY,
    secretAccessKey: envs.AWS_SECRET_KEY,
  },
});

console.log("👷 Worker de reportes (S3 + Cleanup) module cargado (no iniciado)...");

// 2. Función para iniciar el Worker en tiempo de ejecución
export async function startReportsWorker() {
  if (String(process.env.DISABLE_REDIS || '').toLowerCase() === 'true') {
    console.warn('⚠️ reports.worker: DISABLE_REDIS=true, worker no arrancado');
    return null;
  }

  const REDIS_URL = process.env.REDIS_URL || `redis://${envs.REDIS_HOST || '127.0.0.1'}:${envs.REDIS_PORT || 6379}`;

  // Intentamos crear la conexión y el worker, pero si Redis no está disponible
  // debemos fallar de forma suave para que la API pueda seguir arrancando.
  let connection = null;
  let worker = null;
  try {
    connection = await connectRedisIfAvailable(REDIS_URL, redisOptions, 800);
    if (!connection) {
      console.warn('⚠️ reports.worker: Redis no disponible (timeout) - Continuando sin sistema de reportes en segundo plano.');
      return null;
    }

    worker = new Worker('reports-queue', async (job) => {
  const { reportId, type, content, webhookUrl } = job.data;
  const fileName = `report-${reportId}.pdf`;
  const tempPath = path.join('/tmp', fileName); // Ruta temporal local

  console.log(`🔄 [Job ${job.id}] Procesando reporte ${type}...`);

  try {
    // A. Actualizar estado en DB a PROCESSING
    // Usamos 'ReportLog' porque es la tabla preparada para guardar URLs de archivos
    await prisma.reportLog.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' }
    });

    // B. GENERAR ARCHIVO (Simulación de creación real)
    // En producción, aquí iría PDFKit. Aquí creamos el archivo físico para poder subirlo.
    await fs.writeFile(tempPath, `Contenido del reporte ID: ${reportId}\nDatos: ${JSON.stringify(content)}`);

    // C. SUBIR A AWS S3
    const fileBuffer = await fs.readFile(tempPath);
    await s3Client.send(new PutObjectCommand({
      Bucket: envs.AWS_BUCKET_NAME,
      Key: `reports/${fileName}`,
      Body: fileBuffer,
      ContentType: 'application/pdf'
    }));
    
    // Construir la URL pública
    const publicUrl = `https://${envs.AWS_BUCKET_NAME}.s3.amazonaws.com/reports/${fileName}`;

    // D. Actualizar DB a COMPLETED con la URL real
    await prisma.reportLog.update({
      where: { id: reportId },
      data: { 
        status: 'COMPLETED',
        fileUrl: publicUrl
      }
    });

    // E. Callback de Notificación (Requisito 5.5)
    if (webhookUrl) {
      try {
        await axios.post(webhookUrl, { jobId: job.id, status: 'COMPLETED', url: publicUrl });
        console.log(`🔔 [Job ${job.id}] Webhook enviado.`);
      } catch (err) {
        console.error(`⚠️ [Job ${job.id}] Fallo al enviar webhook (No crítico).`);
      }
    }

    console.log(`✅ [Job ${job.id}] Terminado exitosamente: ${publicUrl}`);
    return { status: 'ok', url: publicUrl };

  } catch (error) {
    console.error(`❌ [Job ${job.id}] Error crítico:`, error);
    
    // Marcar como fallido en DB
    await prisma.reportLog.update({
      where: { id: reportId },
      data: { status: 'FAILED' }
    });
    
    throw error;

  } finally {
    // F. LIMPIEZA LOCAL (Requisito Crítico 5.5)
    // El "garbage collector": borra el archivo de /tmp SIEMPRE.
    try {
      await fs.unlink(tempPath);
      console.log(`🧹 [Job ${job.id}] Archivo temporal eliminado.`);
    } catch (e) {
      // Ignoramos si el archivo no existía
    }
  }
    }, { 
      connection,      // Usa conexión creada dinámicamente
      concurrency: 5,  // Requisito 5.6: Procesar máx 5 a la vez
      autorun: true
    });

    worker.on('error', (err) => console.error('reports.worker error:', err));

    // Escuchar errores de la conexión Redis para loguearlos sin lanzar
    if (connection && typeof connection.on === 'function') {
      connection.on('error', (e) => console.warn('reports.worker Redis error:', e && e.message ? e.message : e));
    }

    return worker;
  } catch (err) {
    console.warn('⚠️ reports.worker: Redis/Worker no disponible, worker no arrancado:', err && err.message ? err.message : err);
    try { if (connection && typeof connection.quit === 'function') connection.quit(); } catch (e) { /* ignore */ }
    return null;
  }
}

export default startReportsWorker;