import * as dashboardService from '../../services/submodulos/dashboard.service.js';
import { getDashboardSummarySchema, getDashboardRangeSchema } from '../../schemas/submodulos/dashboard.schema.js';

// --- TAREA 4.6: DATA FRESHNESS ---
// Función auxiliar para inyectar el timestamp obligatorio en las respuestas
const withTimestamp = (data) => {
    return {
        ...data,                 // Mantiene los datos originales del servicio
        data_timestamp: new Date() // Agrega la marca de tiempo
    };
};
// ---------------------------------

export const getSummary = async (req, res) => {
    try {
        const validation = getDashboardSummarySchema.safeParse(req);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.format() });
        }

        const result = await dashboardService.getSummary(validation.data.query);
        
        // Enviamos la respuesta con el timestamp inyectado
        res.json(withTimestamp(result));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getSummaryRange = async (req, res) => {
    try {
        const validation = getDashboardRangeSchema.safeParse(req);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.format() });
        }

        const result = await dashboardService.getSummaryRange(validation.data.query);

        // Enviamos la respuesta con el timestamp inyectado
        res.json(withTimestamp(result));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};