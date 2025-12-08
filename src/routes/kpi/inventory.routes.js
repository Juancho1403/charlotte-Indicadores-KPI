import { Router } from 'express';
import { getPareto, getAlerts } from '../../controllers/kpi/inventory.controller.js';

const router = Router();

// Análisis de Pareto (Top Ventas)
router.get('/pareto', getPareto);
// Alertas de stock
router.get('/alerts', getAlerts);

export default router;
