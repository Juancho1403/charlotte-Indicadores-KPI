import { Router } from 'express';
import { getSalesHourly, getParetoProducts } from '../../controllers/kpi/charts.controller.js';

const router = Router();

// Ventas por hora
router.get('/sales-hourly', getSalesHourly);
// Productos Pareto para gráficos
router.get('/pareto-products', getParetoProducts);

export default router;
