import { Router } from 'express';
import { getStaffRanking, getSlaBreakdown, getPerformance } from '../../controllers/kpi/operations.controller.js';

const router = Router();

// Ranking de personal
router.get('/staff-ranking', getStaffRanking);
// Desglose de SLA (Tiempos)
router.get('/sla-breakdown', getSlaBreakdown);
// Métricas de rendimiento
router.get('/performance', getPerformance);

export default router;
