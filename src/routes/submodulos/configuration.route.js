import { Router } from 'express';
import * as configurationController from '../../controllers/submodulos/configuration.controller.js';

const router = Router();

router.patch('/goals/:id', configurationController.updateGoal);
router.put('/thresholds/:metric_key', configurationController.updateThreshold);
router.get('/data', )//Falta controlador para la ruta
router.post('/data', )//Falta controlador

export default router;
