import { Router } from 'express';
import { getDashboardSummary } from '../../controllers/kpi/dashboard.controller.js';

const router = Router();

// Ruta para obtener el resumen ejecutivo del día
router.get('/summary', getDashboardSummary);

export default router;
