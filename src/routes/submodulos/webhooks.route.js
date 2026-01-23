import { Router } from 'express';
import * as webhooksController from '../../controllers/submodulos/webhooks.controller.js';
import { idempotencyMiddleware } from '../../middlewares/idempotency.middleware.js';

const router = Router();

// Delivery webhook: kitchen ready, etc.
router.post('/delivery/ready', idempotencyMiddleware, webhooksController.deliveryReady);
// Kitchen webhook
router.post('/kitchen/ready', idempotencyMiddleware, webhooksController.kitchenReady);

export default router;
