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
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DashboardSummary'
 *       400:
 *         description: Error en la solicitud.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 *         example: "2026-01-01"
 *       - in: query
 *         name: date_to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-01-23"
 *     responses:
 *       200:
 *         description: Datos históricos para gráficos.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     labels:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["2026-01-21", "2026-01-22", "2026-01-23"]
 *                     datasets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label: { type: string, example: "Ventas" }
 *                           data: { type: array, items: { type: number }, example: [1200, 1500, 1100] }
 */
router.get('/summary/range', dashboardController.getSummaryRange);

export default router;
