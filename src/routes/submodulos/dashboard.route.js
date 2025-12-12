import { Router } from 'express';
import * as dashboardController from '../../controllers/submodulos/dashboard.controller.js';

const router = Router();

router.get('/summary', dashboardController.getSummary);
router.get('/summary/range', dashboardController.getSummaryRange);

export default router;
