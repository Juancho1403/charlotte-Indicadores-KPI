import * as inventoryService from '../../services/submodulos/inventory.service.js';
import { getParetoSchema, getAlertsSchema, getItemDetailsSchema } from '../../schemas/submodulos/inventory.schema.js';

export const getPareto = async (req, res) => {
    try {
        const validation = getParetoSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await inventoryService.getPareto(validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getAlerts = async (req, res) => {
    try {
        const validation = getAlertsSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await inventoryService.getAlerts(validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getItemDetails = async (req, res) => {
    try {
        const validation = getItemDetailsSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await inventoryService.getItemDetails(validation.data.params.item_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
