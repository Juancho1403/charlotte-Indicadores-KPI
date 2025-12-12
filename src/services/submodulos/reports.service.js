import { prisma } from '../../db/client.js';

export const generateExport = async (data) => {
    // TODO: Encolar job de exportación
    return {
        success: true,
        message: "Reporte en cola.",
        job_id: "job-" + Date.now(),
        expires_in: 3600
    };
};

export const getJobStatus = async (jobId) => {
    // TODO: Consultar estado de job
    return { job_id: jobId, status: "PENDING", progress: 0 };
};
