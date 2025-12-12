import * as dashboardService from '../../services/submodulos/dashboard.service.js';
import { getDashboardSummarySchema, getDashboardRangeSchema } from '../../schemas/submodulos/dashboard.schema.js';

export const getSummary = async (req, res) => {
    try {
        const validation = getDashboardSummarySchema.safeParse(req);
        if (!validation.success) {
            return res.status(400).json({ errors: validation.error.format() });
        }

        const result = await dashboardService.getSummary(validation.data.query);
        res.json(result);
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
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
