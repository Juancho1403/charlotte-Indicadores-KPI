import { Worker } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { connection } from '../../config/queue.js'; // Tu configuración existente
import { envs } from '../../config/envs.js'; // Las variables que configuramos
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Configurar Cliente AWS S3
const s3Client = new S3Client({
  region: envs.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: envs.AWS_ACCESS_KEY,
    secretAccessKey: envs.AWS_SECRET_KEY,
  },
});

console.log("👷 Worker de reportes (S3 + Cleanup) INICIADO...");

// 2. Definición del Worker
const worker = new Worker('reports-queue', async (job) => {
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
  connection,      // Usa tu conexión Redis existente
  concurrency: 5,  // Requisito 5.6: Procesar máx 5 a la vez
  autorun: true    // Cambiado a true para que escuche apenas arranque la app
});

export default worker;