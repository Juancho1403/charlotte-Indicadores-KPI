import { z } from 'zod';

export const getParetoSchema = z.object({
    query: z.object({
        limit: z.coerce.number().optional(),
        date_from: z.string().date().optional(),
        date_to: z.string().date().optional(),
        store_id: z.coerce.number().optional(),

        // --- AGREGADO: Para la Tarea 2.5 (Invalidar Caché) ---
        // Acepta "true" (string) o true (boolean)
        force_refresh: z.union([z.string(), z.boolean()]).optional(),
    }),
});

export const getAlertsSchema = z.object({
    query: z.object({
        severity: z.enum(['CRITICAL', 'WARNING', 'ALL']).optional(),
        store_id: z.coerce.number().optional(),
    }),
});

export const getItemDetailsSchema = z.object({
    params: z.object({
        item_id: z.string(), // o numero segun BD
    }),
});
