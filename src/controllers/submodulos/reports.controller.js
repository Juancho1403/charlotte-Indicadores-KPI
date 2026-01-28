// Archivo: src/controllers/submodulos/reports.controller.js
import * as reportsService from '../../services/submodulos/reports.service.js';
import { generateExportSchema, getJobStatusSchema } from '../../schemas/submodulos/reports.schema.js';
import { reportQueue } from '../../config/queue.js';
import fs from 'fs/promises';
import path from 'path';
import { getCompletedReport } from '../../workers/reports.worker.js';

export const exportReport = async (req, res) => {
    try {
        // 1. Validación de entrada
        const validation = generateExportSchema.safeParse(req);
        if (!validation.success) {
            return res.status(400).json({ 
                success: false, 
                message: "Datos inválidos",
                errors: validation.error.format() 
            });
        }

        // 2. Obtener datos de contexto
        const userId = req.user?.id || 1; 
        const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString();

        // 3. Llamar al servicio (que maneja DB y Cola)
        const result = await reportsService.generateExport(userId, {
            ...validation.data.body,
            ip // Pasamos IP para auditoría si fuera necesario
        });
        
        // 4. Responder 202 Accepted con el ID del job
        res.status(202).json(result);

    } catch (error) {
        console.error("Error en generateExport:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const downloadReport = async (req, res) => {
    try {
        const { job_id } = req.params;
        
        // Obtener información del reporte desde memoria
        const report = getCompletedReport(job_id);

        if (!report || report.status !== 'COMPLETED' || !report.filePath) {
            return res.status(404).json({ error: 'Reporte no encontrado o no completado' });
        }

        const filePath = report.filePath;
        
        // Verificar que el archivo existe
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        // Configurar headers para descarga
        const fileName = `report-${job_id}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        // Enviar archivo
        res.sendFile(filePath);

    } catch (error) {
        console.error("Error en downloadReport:", error);
        res.status(500).json({ error: error.message });
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
