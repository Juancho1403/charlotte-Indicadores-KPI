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
        date: z.string().optional(), 
    }).optional(), 
});

export const getStaffMetricsSchema = z.object({
    params: z.object({ 
        waiter_id: z.union([
            z.string().min(1), 
            z.number().int().positive()
        ]), 
    }),
    query: z.object({ 
        date_from: z.string().optional(), 
        date_to: z.string().optional(), 
        granularity: z.enum(['daily', 'weekly', 'monthly']).optional(), 
        page: z.preprocess((v) => { 
            if (v === undefined || v === null || v === '') 
                return undefined; const n = Number(v); 
            return Number.isNaN(n) ? v : Math.trunc(n); 
        }, z.number().int().positive().optional()), 
        page_size: z.preprocess((v) => { 
            if (v === undefined || v === null || v === '') 
                return undefined; const n = Number(v); 
            return Number.isNaN(n) ? v : Math.trunc(n); 
        }, z.number().int().positive().optional()), }),
});
