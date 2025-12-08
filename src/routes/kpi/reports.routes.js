import { Router } from 'express';
import { generateExport } from '../../controllers/kpi/reports.controller.js';

const router = Router();

// Generar exportación de reporte
router.post('/export', generateExport);

export default router;
