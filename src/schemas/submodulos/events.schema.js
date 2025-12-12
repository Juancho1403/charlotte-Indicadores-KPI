import { z } from 'zod';

export const ingestEventSchema = z.object({
    body: z.object({
        event_id: z.string(),
        event: z.string(),
        payload: z.record(z.any()),
        source: z.string().optional(),
    }),
});
