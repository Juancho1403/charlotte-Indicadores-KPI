import { Router } from 'express';
import * as configurationController from '../../controllers/submodulos/configuration.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/kpi/configuration/goals/{id}:
 *   patch:
 *     summary: Actualizar una meta de KPI específica
 *     tags: [Configuration]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meta actualizada correctamente.
 */
router.patch('/goals/:id', configurationController.updateGoal);

/**
 * @swagger
 * /api/v1/kpi/configuration/thresholds/{metric_key}:
 *   put:
 *     summary: Configurar umbrales de semáforo para una métrica
 *     tags: [Configuration]
 *     parameters:
 *       - in: path
 *         name: metric_key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Umbrales guardados.
 */
router.put('/thresholds/:metric_key', configurationController.updateThreshold);

/**
 * @swagger
 * /api/v1/kpi/configuration/data/{metric_key}:
 *   get:
 *     summary: Obtener reglas vigentes por métrica
 *     tags: [Configuration]
 */
router.get('/data/:metric_key', configurationController.getCurrentRules);

/**
 * @swagger
 * /api/v1/kpi/configuration/data/{metric_key}:
 *   post:
 *     summary: Crear o actualizar reglas de negocio para métricas
 *     tags: [Configuration]
 */
router.post('/data/:metric_key', configurationController.updateCurrentRules);

export default router;
