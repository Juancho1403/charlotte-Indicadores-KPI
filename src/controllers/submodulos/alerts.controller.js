import * as alertsService from '../../services/submodulos/alerts.service.js';
import { createAlertSchema, getAlertHistorySchema } from '../../schemas/submodulos/alerts.schema.js';

export const createAlert = async (req, res) => {
    try {
        const validation = createAlertSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await alertsService.createAlert(validation.data.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getHistory = async (req, res) => {
    try {
        const validation = getAlertHistorySchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await alertsService.getHistory(validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
