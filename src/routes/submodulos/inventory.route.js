import { Router } from 'express';
import * as inventoryController from '../../controllers/submodulos/inventory.controller.js';

const router = Router();

router.get('/pareto', inventoryController.getPareto);
router.get('/alerts', inventoryController.getAlerts);
router.get('/items/:item_id', inventoryController.getItemDetails);

export default router;
