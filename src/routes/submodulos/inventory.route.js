import { Router } from 'express';
import * as inventoryController from '../../controllers/submodulos/inventory.controller.js';

const router = Router();
// GET /kpi/inventory/pareto 
router.get('/pareto', inventoryController.getPareto);
// Otros endpoints
router.get('/alerts', inventoryController.getAlerts);
router.get('/items/:item_id', inventoryController.getItemDetails);

export default router;
