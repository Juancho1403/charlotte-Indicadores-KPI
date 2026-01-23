import { Router } from 'express';
import * as dashboardController from '../../controllers/submodulos/dashboard.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/kpi/dashboard/summary:
 *   get:
 *     summary: Obtener resumen ejecutivo del dashboard
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha de consulta (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Objeto con métricas de ingresos, operaciones y metas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/summary', dashboardController.getSummary);

/**
 * @swagger
 * /api/v1/kpi/dashboard/summary/range:
 *   get:
 *     summary: Obtener resumen histórico por rango
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: date_from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Datos históricos para gráficos.
 */
router.get('/summary/range', dashboardController.getSummaryRange);

export default router;
