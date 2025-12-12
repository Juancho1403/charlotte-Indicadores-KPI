import { Router } from 'express';
import * as operationsController from '../../controllers/submodulos/operations.controller.js';

const router = Router();

router.get('/staff-ranking', operationsController.getStaffRanking);
router.get('/sla-breakdown', operationsController.getSlaBreakdown);
router.get('/staff-metrics/:waiter_id', operationsController.getStaffMetrics);

export default router;
