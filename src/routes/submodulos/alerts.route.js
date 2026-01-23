import { Router } from 'express';
import * as alertsController from '../../controllers/submodulos/alerts.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/kpi/alerts:
 *   post:
 *     summary: Crear una nueva alerta manual o de sistema
 *     tags: [Alerts]
 *     responses:
 *       201:
 *         description: Alerta creada.
 */
router.post('/', alertsController.createAlert);

/**
 * @swagger
 * /api/v1/kpi/alerts/history:
 *   get:
 *     summary: Obtener historial de alertas filtrado
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: Lista de alertas históricas.
 */
router.get('/history', alertsController.getHistory);

export default router;
