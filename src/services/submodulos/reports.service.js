import { reportQueue } from '../../config/queue.js'; // Importamos tu cola
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

export const generateExport = async (userId, data) => {
  // 1. Crear registro en BD (ReportLog) con estado PENDING
  // Usamos ReportLog para compatibilidad con el worker de S3
  const reportLog = await prisma.reportLog.create({
      data: {
          status: 'PENDING',
          type: data.report_type || 'FULL_TRANSACTIONS',
          // Guardamos metadatos temporales si es necesario para depuración, 
          // aunque el worker recibe los datos en el job.
      }
  });

  // 2. Preparar payload para el Worker
  const jobPayload = {
      reportId: reportLog.id, // ID del log para que el worker actualice el estado
      type: data.report_type,
      content: { // Filtros y datos necesarios para generar el reporte
          start_date: data.start_date,
          end_date: data.end_date,
          format: data.format,
          userId: userId
      },
      webhookUrl: null // Opcional, según documentación
  };

  // 3. Enviar el trabajo a Redis (o StubQueue)
  // Nota: El worker espera job.data con la estructura de arriba
  const job = await reportQueue.add('generate-report', jobPayload);

  // 4. Retornar respuesta formateada (API 3.0 Doc: 1.5.1)
  return {
      success: true,
      message: "Reporte en cola de generación.",
      job_id: reportLog.id // Retornamos el ID del reporte (DB) para status polling, no el ID de Bull
  };
};

// Obtener estado del job (API 3.0 Doc: 1.5.2)
export const getJobStatus = async (reportId) => {
    const report = await prisma.reportLog.findUnique({
        where: { id: reportId }
    });

    if (!report) {
        return { status: 'NOT_FOUND' };
    }

    return {
        job_id: report.id,
        status: report.status, // PENDING, PROCESSING, COMPLETED, FAILED
        progress: report.status === 'COMPLETED' ? 100 : (report.status === 'PROCESSING' ? 50 : 0),
        download_url: report.fileUrl
    };
};