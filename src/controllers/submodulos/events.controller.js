import * as eventsService from '../../services/submodulos/events.service.js';
import { ingestEventSchema } from '../../schemas/submodulos/events.schema.js';

export const ingestEvent = async (req, res) => {
    try {
        const validation = ingestEventSchema.safeParse(req);
        if (!validation.success) return res.status(400).json({ errors: validation.error.format() });

        const result = await eventsService.ingestEvent(validation.data.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
