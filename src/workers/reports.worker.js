import { Worker } from 'bullmq';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { envs } from '../config/envs.js'; // Las variables que configuramos
import { fetchComandas, fetchDeliveryOrders } from '../services/consumers/externalConsumers.js';
import IORedis from 'ioredis';
import { prisma } from '../db/client.js';
import { connectRedisIfAvailable } from '../utils/redis.util.js';
import { te } from 'date-fns/locale';

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: times => Math.min(times * 50, 2000),
};

// 1. Configurar Cliente AWS S3 - ELIMINADO
// const s3Client = new S3Client({...});

console.log("👷 Worker de reportes (Local FS cleanup) module cargado (no iniciado)...");

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
  const tempDir = path.join(process.cwd(), 'src', 'tmp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, fileName); // Ruta persistente local
  console.log(`📂 Guardando reporte en: ${tempPath}`);
  console.log(`🔄 [Job ${job.id}] Procesando reporte ${type}...`);

  try {
    // A. Actualizar estado en DB a PROCESSING
    // Usamos 'ReportLog' porque es la tabla preparada para guardar URLs de archivos
    const response = await prisma.reportLog.update({
      where: { id: reportId },
      data: { status: 'PROCESSING' }
    });

    // B. GENERAR DATOS (Agregación de APIs Externas)
    let aggregatedData = [];
    try {
        const targetDateStr = content.start_date || new Date().toISOString().slice(0, 10);
        
        // Fetch Sala
        try {
          const resAtData = await fetchComandas();
          const dataAt = Array.isArray(resAtData) ? resAtData : (resAtData.data || []);
          aggregatedData.push(...dataAt.map(c => ({ ...c, source: 'SALA' })));
        } catch (error) {
           console.warn(`⚠️ [Job ${job.id}] Error fetching Comandas: ${error.message}`);
        }

        // Fetch Delivery
        try {
          const dataDel = await fetchDeliveryOrders({ date: targetDateStr });
          aggregatedData.push(...dataDel.map(o => ({ ...o, source: 'DELIVERY' })));
        } catch (error) {
           console.warn(`⚠️ [Job ${job.id}] Error fetching Delivery Orders: ${error.message}`);
        }
    } catch (e) {
        console.warn(`⚠️ [Job ${job.id}] Error al agregar datos externos: ${e.message}`);
    }

    // C. GENERAR ARCHIVO (CSV/Text)
    const reportContent = `Reporte de Transacciones - ${type}\n` +
                          `Generado: ${new Date().toISOString()}\n` +
                          `-----------------------------------\n` +
                          `ID,Fuente,Total,Fecha\n` +
                          aggregatedData.map(d => `${d.id || d._id},${d.source},${d.total || d.monto_total || 0},${d.created_at || d.createdAt || ''}`).join('\n');
    console.log(reportContent)
    await fs.writeFile(tempPath, reportContent);
    // C. SUBIR A AWS S3 (ELIMINADO - Solo local)
    // El archivo ya está en tempPath (src/tmp)
    const publicUrl = `local:${tempPath}`;
    console.log(`✅ Archivo disponible localmente: ${publicUrl}`);
    
    // D. Actualizar DB a COMPLETED con la URL local
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
    // F. LIMPIEZA LOCAL
    // NO borramos el archivo de src/tmp según requerimiento.
    console.log(`✅ [Job ${job.id}] Reporte persistido en ${tempPath}`);
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