import * as configurationService from '../../services/submodulos/configuration.service.js';
import { updateGoalSchema, updateThresholdSchema } from '../../schemas/submodulos/configuration.schema.js';

export const updateGoal = async (req, res) => {
    try {
        const validation = updateGoalSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await configurationService.updateGoal(validation.data.params.id, validation.data.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateThreshold = async (req, res) => {
    try {
        const validation = updateThresholdSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await configurationService.updateThreshold(validation.data.params.metric_key, validation.data.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
