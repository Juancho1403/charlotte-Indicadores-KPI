import * as reportsService from '../../services/submodulos/reports.service.js';
import { generateExportSchema, getJobStatusSchema } from '../../schemas/submodulos/reports.schema.js';
import { Queue } from 'bullmq';

export const generateExport = async (req, res) => {
    try {
        const validation = generateExportSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await reportsService.generateExport(validation.data.body);
        res.status(202).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    
    try { 
        const connection = new IORedis({ 
            host: process.env.REDIS_HOST || '127.0.0.1', 
            port: Number(process.env.REDIS_PORT || 6379), 
            password: process.env.REDIS_PASSWORD || undefined, 
        }); 
        const queue = new Queue(process.env.QUEUE_NAME || 'kpi-export-queue', { connection }); 
        const usuarioId = req.user?.id ?? Number(req.headers['x-user-id'] || 0); 
        if (!usuarioId) 
            return res.status(400).json({ error: 'usuarioId no proporcionado' }); 
        const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString(); 
        const job = await queue.add('export-kpi', { 
            usuarioId, ip, filters: req.body.filters ?? {}, 
            format: req.body.format ?? 'unknown', 
        }, { 
            attempts: 3, 
            backoff: { 
                type: 'exponential', 
                delay: 5000 
            }, 
        }); 
        return res.status(202).json({ 
            jobId: job.id, message: 'Export encolado' 
        }); 
    } catch (err) { 
        console.error('Error en /kpi/reports/export:', err); 
        return res.status(500).json({ error: 'Error interno' }); 
    }
};

export const getJobStatus = async (req, res) => {
    try {
        const validation = getJobStatusSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await reportsService.getJobStatus(validation.data.params.job_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
