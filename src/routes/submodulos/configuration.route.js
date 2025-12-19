import { Router } from 'express';
import * as configurationController from '../../controllers/submodulos/configuration.controller.js';

const router = Router();

router.patch('/goals/:id', configurationController.updateGoal);
router.put('/thresholds/:metric_key', configurationController.updateThreshold);
router.get('/data', configurationController.getCurrentRules);
router.post('/data', configurationController.updateCurrentRules);

export default router;
