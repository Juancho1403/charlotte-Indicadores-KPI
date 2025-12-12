import * as reportsService from '../../services/submodulos/reports.service.js';
import { generateExportSchema, getJobStatusSchema } from '../../schemas/submodulos/reports.schema.js';

export const generateExport = async (req, res) => {
    try {
        const validation = generateExportSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await reportsService.generateExport(validation.data.body);
        res.status(202).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
