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
 *     responses:
 *       200:
 *         description: Lista ordenada de empleados con sus métricas.
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
 *     responses:
 *       200:
 *         description: Serie temporal de desempeño del empleado.
 */
router.get('/staff-metrics/:waiter_id', operationsController.getStaffMetrics);

export default router;
