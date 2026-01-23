import { Router } from 'express';
import * as operationsController from '../../controllers/submodulos/operations.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/kpi/operations/staff-ranking:
 *   get:
 *     summary: Obtener el ranking de eficiencia del personal
 *     tags: [Operations]
 *     parameters:
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [EFFICIENCY, VOLUME]
 *           default: EFFICIENCY
 *     responses:
 *       200:
 *         description: Lista ordenada de empleados con sus métricas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StaffMember'
 */
router.get('/staff-ranking', operationsController.getStaffRanking);

/**
 * @swagger
 * /api/v1/kpi/operations/sla-breakdown:
 *   get:
 *     summary: Análisis del cumplimiento de tiempos (SLA)
 *     tags: [Operations]
 *     responses:
 *       200:
 *         description: Distribución de órdenes en zonas Verde, Amarilla y Roja.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 green_zone_percent: { type: integer, example: 75 }
 *                 yellow_zone_percent: { type: integer, example: 15 }
 *                 red_zone_percent: { type: integer, example: 10 }
 *                 data_timestamp: { type: string, format: date-time, example: "2026-01-23T15:00:00Z" }
 */
router.get('/sla-breakdown', operationsController.getSlaBreakdown);

/**
 * @swagger
 * /api/v1/kpi/operations/staff-metrics/{waiter_id}:
 *   get:
 *     summary: Métricas detalladas e históricas de un camarero específico
 *     tags: [Operations]
 *     parameters:
 *       - in: path
 *         name: waiter_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "101"
 *     responses:
 *       200:
 *         description: Serie temporal de desempeño del empleado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta: { type: object }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "2026-01-22" }
 *                       daily_orders: { type: integer, example: 15 }
 *                       avg_time: { type: integer, example: 12 }
 */
router.get('/staff-metrics/:waiter_id', operationsController.getStaffMetrics);

export default router;
