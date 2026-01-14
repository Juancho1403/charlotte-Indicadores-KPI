// Archivo: src/controllers/submodulos/reports.controller.js
import * as reportsService from '../../services/submodulos/reports.service.js';
import { generateExportSchema, getJobStatusSchema } from '../../schemas/submodulos/reports.schema.js';
import { Queue } from 'bullmq';

export const exportReport = async (req, res) => {
    try {
        //  Validamos que los datos que envía el usuario sean correctos (Zod)
        const validation = generateExportSchema.safeParse(req);
        if (!validation.success) {
            return res.status(400).json({ 
                success: false, 
                message: "Datos inválidos",
                errors: validation.error.format() 
            });
        }

        //  OBTENER EL USUARIO 
        // Como vamos a guardar en BD, necesitamos saber de quién es el reporte.
        // req.user viene de middleware de seguridad (JWT). 
        // Si esta probando sin login, usa el "|| 1" como respaldo temporal.
        const userId = req.user?.id || 1; 

        //  se llama al servicio con (Usuario, Filtros)
        const result = await reportsService.generateExport(userId, validation.data.body);
        
        //  Respondemos con 202 (Accepted) porque el proceso se hará en background
        res.status(202).json(result);

    } catch (error) {
        console.error("Error en generateExport:", error);
        res.status(500).json({ success: false, error: error.message });
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
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.format() });
        }

        // Pasamos el ID del reporte (o job_id) que viene en la URL
        const result = await reportsService.getJobStatus(validation.data.params.job_id);
        
        // Si el servicio dice "NOT_FOUND", devolvemos 404, si no, 200
        if (result.status === 'NOT_FOUND') {
             return res.status(404).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error("Error en getJobStatus:", error);
        res.status(500).json({ error: error.message });
    }
};
