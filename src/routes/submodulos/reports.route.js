import { Router } from 'express';
import { exportReport, getJobStatus, downloadReport } from '../../controllers/submodulos/reports.controller.js';
// Importamos el middleware que creaste hace poco
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';

const router = Router();

// Endpoint POST con protección de Idempotencia
/**
 * @swagger
 * /api/v1/kpi/reports/export:
 *   post:
 *     summary: Solicitar generación de reporte CSV/Excel
 *     tags: [Reports]
 *     responses:
 *       202:
 *         description: Reporte encolado exitosamente. Retorna job_id.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 job_id: { type: string, example: "job_abcd_1234" }
 */
router.post('/export', idempotencyMiddleware, exportReport);

/**
 * @swagger
 * /api/v1/kpi/reports/jobs/{job_id}:
 *   get:
 *     summary: Consultar estado de un proceso de exportación
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "job_abcd_1234"
 *     responses:
 *       200:
 *         description: Estado actual del proceso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 job_id: { type: string, example: "job_abcd_1234" }
 *                 status: { type: string, enum: [PENDING, COMPLETED, FAILED], example: "COMPLETED" }
 *                 download_url: { type: string, example: "https://s3.amazonaws.com/reports/kpi_2026.csv" }
 */
router.get('/jobs/:job_id', getJobStatus);

/**
 * @swagger
 * /api/v1/kpi/reports/download/{job_id}:
 *   get:
 *     summary: Descargar archivo de reporte generado
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: job_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "job_abcd_1234"
 *     responses:
 *       200:
 *         description: Archivo Excel descargable
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Reporte no encontrado o no completado
 */
router.get('/download/:job_id', downloadReport);

export default router;