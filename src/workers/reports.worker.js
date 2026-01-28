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
import ExcelJS from 'exceljs';
import * as kpiService from '../services/kpi.service.js';

// Almacenamiento simple en memoria para reportes completados
const completedReports = new Map();

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
  const fileName = `report-${reportId}.xlsx`;
  const tempDir = path.join(process.cwd(), 'src', 'tmp');
  await fs.mkdir(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, fileName); // Ruta persistente local
  console.log(`📂 Guardando reporte en: ${tempPath}`);
  console.log(`🔄 [Job ${job.id}] Procesando reporte ${type}...`);

  try {
    // A. No usamos base de datos, solo procesamos el reporte
    console.log(`🔄 [Job ${job.id}] Procesando reporte ${type}...`);

    // B. GENERAR DATOS (Kitchen Queue)
    let kitchenQueueData = [];
    try {
        const queueResponse = await kpiService.getKitchenQueue();
        kitchenQueueData = queueResponse.queue || [];
        console.log(`📊 [Job ${job.id}] Obtenidos ${kitchenQueueData.length} registros de Kitchen Queue`);
    } catch (error) {
        console.warn(`⚠️ [Job ${job.id}] Error fetching Kitchen Queue: ${error.message}`);
    }

    // C. LIMPIEZA DE ARCHIVOS ANTIGUOS
    await cleanupOldFiles(tempDir);

    // D. GENERAR ARCHIVO EXCEL
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Kitchen Queue Report');
    
    // Agregar encabezados según especificación
    worksheet.columns = [
      { header: 'ID TRANSACCIÓN', key: 'id', width: 40 },
      { header: 'FECHA', key: 'fecha', width: 15 },
      { header: 'HORA', key: 'hora', width: 15 },
      { header: 'CAMARERO', key: 'camarero', width: 20 },
      { header: 'CANTIDAD', key: 'cantidad', width: 12 },
      { header: 'DURACIÓN TOTAL', key: 'duracion', width: 20 }
    ];
    
    // Agregar datos formateados
    kitchenQueueData.forEach(item => {
      const createdAt = new Date(item.createdAt);
      const fecha = createdAt.toISOString().split('T')[0];
      const hora = createdAt.toTimeString().split(' ')[0];
      
      // Calcular duración total
      let duracion = 'N/A';
      if (item.startedAt && item.finishedAt) {
        const started = new Date(item.startedAt);
        const finished = new Date(item.finishedAt);
        const diffMs = finished - started;
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        duracion = `${diffMins}m ${diffSecs}s`;
      } else if (item.startedAt) {
        const started = new Date(item.startedAt);
        const now = new Date();
        const diffMs = now - started;
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        duracion = `${diffMins}m ${diffSecs}s (en progreso)`;
      }
      
      worksheet.addRow({
        id: item.id,
        fecha: fecha,
        hora: hora,
        camarero: item.waiter?.name || item.customerName || 'Sin asignar',
        cantidad: item.quantity || 1,
        duracion: duracion
      });
    });
    
    // Agregar metadata
    worksheet.insertRow(1, [`Reporte de Kitchen Queue - ${type}`]);
    worksheet.insertRow(2, [`Generado: ${new Date().toISOString()}`]);
    worksheet.insertRow(3, [`Total de registros: ${kitchenQueueData.length}`]);
    worksheet.insertRow(4, []);
    
    // Guardar archivo Excel
    await workbook.xlsx.writeFile(tempPath);
    console.log(`✅ Archivo Excel generado: ${tempPath}`);
    // E. SUBIR A AWS S3 (ELIMINADO - Solo local)
    // El archivo ya está en tempPath (src/tmp)
    const publicUrl = `local:${tempPath}`;
    const downloadUrl = `/api/v1/kpi/reports/download/${reportId}`;
    console.log(`✅ Archivo disponible localmente: ${publicUrl}`);
    console.log(`🔗 URL de descarga: ${downloadUrl}`);
    
    // F. Almacenar en memoria en lugar de base de datos
    completedReports.set(reportId, {
      reportId,
      status: 'COMPLETED',
      filePath: tempPath,
      downloadUrl: downloadUrl,
      createdAt: new Date().toISOString(),
      type: type
    });
    console.log(`💾 Reporte almacenado en memoria: ${reportId}`);

    // G. Callback de Notificación (Requisito 5.5)
    if (webhookUrl) {
      try {
        await axios.post(webhookUrl, { 
          jobId: job.id, 
          status: 'COMPLETED', 
          url: publicUrl,
          downloadUrl: downloadUrl
        });
        console.log(`🔔 [Job ${job.id}] Webhook enviado con URL de descarga.`);
      } catch (err) {
        console.error(`⚠️ [Job ${job.id}] Fallo al enviar webhook (No crítico).`);
      }
    }

    console.log(`✅ [Job ${job.id}] Terminado exitosamente: ${publicUrl}`);
    return { 
      status: 'ok', 
      url: publicUrl, 
      downloadUrl: downloadUrl,
      reportId: reportId
    };

  } catch (error) {
    console.error(`❌ [Job ${job.id}] Error crítico:`, error);
    
    // Almacenar estado fallido en memoria
    completedReports.set(reportId, {
      reportId,
      status: 'FAILED',
      error: error.message,
      createdAt: new Date().toISOString()
    });
    
    throw error;

  } finally {
    // H. LIMPIEZA LOCAL
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

// Función para limpiar archivos antiguos del directorio tmp
async function cleanupOldFiles(tempDir) {
  try {
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    const tenMinutes = 10 * 60 * 1000; // 10 minutos en milisegundos
    
    for (const file of files) {
      // Solo procesar archivos .xlsx
      if (!file.endsWith('.xlsx')) {
        continue;
      }
      
      const filePath = path.join(tempDir, file);
      const stats = await fs.stat(filePath);
      
      // Eliminar archivos .xlsx con antiguedad de 10 minutos o más
      if (now - stats.mtime.getTime() >= tenMinutes) {
        await fs.unlink(filePath);
        console.log(`🗑️ Archivo .xlsx antiguo eliminado: ${file}`);
        
        // Eliminar del almacenamiento en memoria también
        const reportId = file.replace('report-', '').replace('.xlsx', '');
        completedReports.delete(reportId);
      }
    }
  } catch (error) {
    console.warn('⚠️ Error al limpiar archivos antiguos:', error.message);
  }
}

// Función para obtener reporte completado
export function getCompletedReport(reportId) {
  return completedReports.get(reportId);
}