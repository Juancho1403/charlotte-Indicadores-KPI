import { z } from 'zod';

export const getDashboardSummarySchema = z.object({
    query: z.object({
        date: z.string().date().optional(),
        store_id: z.coerce.number().optional(),
        force_refresh: z.coerce.boolean().optional(),
    }),
});

export const getDashboardRangeSchema = z.object({
    query: z.object({
        date_from: z.string().date(),
        date_to: z.string().date(),
        store_id: z.coerce.number().optional(),
        granularity: z.enum(['DAY', 'WEEK', 'MONTH']).optional(),
    }),
});
