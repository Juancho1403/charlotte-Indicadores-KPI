import { Router } from 'express';
import { updateFinancialGoal, configureServiceTimeRules } from '../../controllers/kpi/configuration.controller.js';

const router = Router();

// Actualizar meta financiera
router.patch('/goals/:id', updateFinancialGoal);
// Configurar reglas de semáforo
router.put('/rules/service-time', configureServiceTimeRules);

export default router;
