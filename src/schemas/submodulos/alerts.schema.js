import { z } from 'zod';

export const createAlertSchema = z.object({
    body: z.object({
        metric: z.string(),
        severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
        message: z.string(),
        store_id: z.number().optional(),
    }),
});

export const getAlertHistorySchema = z.object({
    query: z.object({
        date_from: z.string().date().optional(),
        date_to: z.string().date().optional(),
        severity: z.enum(['CRITICAL', 'WARNING', 'INFO']).optional(),
        store_id: z.coerce.number().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
    }),
});
