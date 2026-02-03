import { Router } from 'express';
import * as analyticsController from '../../controllers/submodulos/analytics.controller.js';

const router = Router();

router.get('/dashboard/summary', analyticsController.getDashboardSummary);
router.get('/operations/staff-performance', analyticsController.getStaffPerformance);
router.get('/kitchen/queue', analyticsController.getKitchenQueue);
router.get('/inventory/top-products', analyticsController.getTopProducts);
router.get('/kitchen/ingredient-frequency', analyticsController.getIngredientFrequency);

export default router;
