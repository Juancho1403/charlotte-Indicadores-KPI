import { reportQueue } from '../../config/queue.js'; // Importamos tu cola
import { getCompletedReport } from '../../workers/reports.worker.js';

export const generateExport = async (userId, data) => {
  // 1. Generar ID único para el reporte
  const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 2. Preparar payload para el Worker
  const jobPayload = {
      reportId: reportId, // ID único para tracking
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
  const job = await reportQueue.add('generate-report', jobPayload);

  // 4. Esperar a que el worker complete el reporte
  let attempts = 0;
  const maxAttempts = 60; // Máximo 60 segundos esperando
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
    
    const report = getCompletedReport(reportId);
    if (report && report.status === 'COMPLETED') {
      console.log(report.downloadUrl)
      return {
        success: true,
        message: "Reporte generado exitosamente.",
        job_id: reportId,
        download_url: report.downloadUrl,
        status: 'COMPLETED'
      };
    }
    
    if (report && report.status === 'FAILED') {
      return {
        success: false,
        message: "Error al generar el reporte.",
        job_id: reportId,
        error: report.error,
        status: 'FAILED'
      };
    }
    
    attempts++;
  }

  // 5. Si no se completa en el tiempo esperado, retornar ID para polling
  return {
      success: true,
      message: "Reporte en cola de generación.",
      job_id: reportId,
      download_url: null,
      status: 'PROCESSING'
  };
};

// Obtener estado del job
export const getJobStatus = async (reportId) => {
    const report = getCompletedReport(reportId);

    if (!report) {
        return { 
            job_id: reportId,
            status: 'PENDING',
            progress: 0,
            download_url: null,
            download_endpoint: null
        };
    }

    return {
        job_id: report.reportId,
        status: report.status,
        progress: report.status === 'COMPLETED' ? 100 : (report.status === 'PROCESSING' ? 50 : 0),
        download_url: report.filePath ? `local:${report.filePath}` : null,
        download_endpoint: report.status === 'COMPLETED' ? report.downloadUrl : null,
        error: report.error || null
    };
};