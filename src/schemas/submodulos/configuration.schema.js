import { z } from 'zod';

export const updateGoalSchema = z.object({
    params: z.object({
        id: z.coerce.number(),
    }),
    body: z.object({
        target_amount: z.number().optional(),
        end_date: z.string().date().optional(),
    }),
});

export const updateThresholdSchema = z.object({
    params: z.object({
        metric_key: z.string(),
    }),
    body: z.object({
        value_warning: z.number().optional(),
        value_critical: z.number().optional(),
    }),
});

export const currentRules = z.object({
    params: z.object({
        metrick_type: z.string(),
    }),
    body: z.object({
        value_warning: z.number().optional(),
        value_critical: z.number().optional(),
    })
})
