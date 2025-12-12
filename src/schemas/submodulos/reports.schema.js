import { z } from 'zod';

export const generateExportSchema = z.object({
    body: z.object({
        report_type: z.enum(['FULL_TRANSACTIONS', 'SALES', 'TIMES', 'INVENTORY', 'KPI_SUMMARY']),
        start_date: z.string().date(),
        end_date: z.string().date(),
        format: z.enum(['CSV', 'XLSX']),
        store_id: z.number().optional(),
    }),
});

export const getJobStatusSchema = z.object({
    params: z.object({
        job_id: z.string(),
    }),
});
