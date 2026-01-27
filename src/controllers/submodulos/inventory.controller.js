import * as inventoryService from '../../services/submodulos/inventory.service.js';
import { getParetoSchema, getAlertsSchema, getItemDetailsSchema } from '../../schemas/submodulos/inventory.schema.js';

export const getPareto = async (req, res) => {
    try {
        // Validar la petición con Zod
        const validation = getParetoSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        // Extraer el flag 'force_refresh'
        // Verificamos si vino como string "true" o como booleano true
        const queryParams = validation.data.query || {};
        const forceRefresh = queryParams.force_refresh === 'true' || queryParams.force_refresh === true;

        //Llamar al servicio pasando SOLO el booleano
        const data = await inventoryService.getPareto(forceRefresh);

        //  Responder con estructura estandarizada
        res.status(200).json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        console.error("Error getPareto:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getAlerts = async (req, res) => {
    try {
        const validation = getAlertsSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        // Se mantiene igual 
        const result = await inventoryService.getStockAlerts(validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getItemDetails = async (req, res) => {
    try {
        const validation = getItemDetailsSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        // Se mantiene igual 
        const result = await inventoryService.getItemDetails(validation.data.params.item_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};