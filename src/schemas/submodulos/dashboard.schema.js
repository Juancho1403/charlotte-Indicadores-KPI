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
        period: z.enum(['day', 'week', 'month', 'year']).optional(),
        date_from: z.string().date().optional(),
        date_to: z.string().date().optional(),
        store_id: z.coerce.number().optional(),
    }).refine((data) => {
        // Si se proporciona date_from, debe proporcionarse date_to y viceversa
        if (data.date_from && !data.date_to) return false;
        if (data.date_to && !data.date_from) return false;
        return true;
    }, {
        message: "date_from y date_to deben proporcionarse juntos",
        path: ["date_from"]
    }),
});
