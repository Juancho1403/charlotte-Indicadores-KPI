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
    value_warning: z.number({ invalid_type_error: 'value_warning debe ser un número' }) 
    .nonnegative('value_warning debe ser >= 0'), 
    value_critical: z.number({ invalid_type_error: 'value_critical debe ser un número' }) 
    .nonnegative('value_critical debe ser >= 0'), 
}) .refine((data) => data.value_warning < data.value_critical, { 
    message: 'value_warning debe ser menor que value_critical', 
    path: ['value_warning'], 
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
