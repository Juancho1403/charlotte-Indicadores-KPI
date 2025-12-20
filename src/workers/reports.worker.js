import { Worker } from 'bullmq';
import { connection } from '../config/queue.js'; //  usa nueva config que cree 
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log("👷 Worker de reportes INICIADO... esperando trabajos.");

// Definimos el Worker
const worker = new Worker('reports-queue', async (job) => {
  console.log(`🔄 Procesando reporte ID: ${job.id} - Tipo: ${job.data.reportType}`);

  try {
    //  Simular espera de 5 segundos  trabajo pesado
    await new Promise(resolve => setTimeout(resolve, 5000));

    // URL simulada
    const fakeUrl = `https://api.charlotte.com/downloads/temp/rep_${job.id}.csv`;

    //  Actualizar la base de datos a COMPLETED
    await prisma.kpiAuditoriaExport.updateMany({
        where: { jobId: job.id },
        data: { 
            status: 'COMPLETED',
            downloadUrl: fakeUrl
        }
    });

    console.log(`✅ Reporte ${job.id} terminado.`);
    return { status: 'ok', url: fakeUrl };

  } catch (error) {
    console.error(`❌ Error en reporte ${job.id}:`, error);
    throw error;
  }
}, { 
  connection,      // Usa la conexión segura con reintentos
  concurrency: 5,  // Procesa máx 5 a la vez
  autorun: false   // No arranca solo, espera a que lo llamen
});

export default worker;