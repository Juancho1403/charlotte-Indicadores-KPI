import * as operationsService from '../../services/submodulos/operations.service.js';
import { getStaffRankingSchema, getSlaBreakdownSchema, getStaffMetricsSchema } from '../../schemas/submodulos/operations.schema.js';

export const getStaffRanking = async (req, res) => {
    try {
        const validation = getStaffRankingSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await operationsService.getStaffRanking(validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getSlaBreakdown = async (req, res) => {
    try {
        const validation = getSlaBreakdownSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await operationsService.getSlaBreakdown(validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getStaffMetrics = async (req, res) => {
    try {
        const validation = getStaffMetricsSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await operationsService.getStaffMetrics(validation.data.params.waiter_id, validation.data.query);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
