import { Router } from 'express';
import { exportReport, getJobStatus } from '../../controllers/submodulos/reports.controller.js';
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
 *     responses:
 *       200:
 *         description: Estado actual (PENDING, COMPLETED, FAILED).
 */
router.get('/jobs/:job_id', getJobStatus);

export default router;