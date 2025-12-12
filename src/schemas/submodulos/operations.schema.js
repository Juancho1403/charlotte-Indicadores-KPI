import { z } from 'zod';

export const getStaffRankingSchema = z.object({
    query: z.object({
        sort_by: z.enum(['EFFICIENCY', 'VOLUME']).optional(),
        shift: z.enum(['MORNING', 'EVENING']).optional(),
        date_from: z.string().date().optional(),
        date_to: z.string().date().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
    }),
});

export const getSlaBreakdownSchema = z.object({
    query: z.object({
        date: z.string().date().optional(),
    }),
});

export const getStaffMetricsSchema = z.object({
    params: z.object({
        waiter_id: z.string(),
    }),
    query: z.object({
        date_from: z.string().date().optional(),
        date_to: z.string().date().optional(),
        granularity: z.enum(['DAY', 'WEEK', 'MONTH']).optional(),
    }),
});
