import { reportQueue } from '../../config/queue.js'; // Importamos tu cola
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createAsyncReport = async (data) => {
  // 1. Enviar el trabajo a Redis
  const job = await reportQueue.add('generate-csv', {
      reportType: data.report_type,
      start_date: data.start_date,
      end_date: data.end_date,
      format: data.format
  });

  // 2. Guardar auditoría en Base de Datos (Estado PENDING)
  await prisma.kpiAuditoriaExport.create({
      data: {
          reportType: data.report_type,
          status: 'PENDING',
          jobId: job.id,
          usuarioId: 1, // En el futuro usarás req.user.id
          filtrosAplicados: JSON.stringify({ start: data.start_date, end: data.end_date }),
          formato: data.format || 'CSV'
      }
  });

  return job.id;
};