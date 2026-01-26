import { Router } from 'express';
import * as dashboardController from '../../controllers/submodulos/dashboard.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Métricas principales para el tablero de control
 */

/**
 * @swagger
 * /api/v1/kpi/dashboard/summary:
 *   get:
 *     summary: Obtener resumen del dashboard
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month]
 *         description: Período de tiempo para el resumen (default today)
 *     responses:
 *       200:
 *         description: Resumen exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardSummary'
 *       500:
 *         description: Error del servidor
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
