import { Router } from 'express';
import * as alertsController from '../../controllers/submodulos/alerts.controller.js';

const router = Router();

router.post('/', alertsController.createAlert);
router.get('/history', alertsController.getHistory);

export default router;
