import { Router } from 'express';
import { exportReport } from '../../controllers/submodulos/reports.controller.js';
// Importamos el middleware que creaste hace poco
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';

const router = Router();

// Endpoint POST con protección de Idempotencia
router.post('/export', idempotencyMiddleware, exportReport);

export default router;