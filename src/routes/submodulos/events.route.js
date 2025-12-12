import { Router } from 'express';
import * as eventsController from '../../controllers/submodulos/events.controller.js';

const router = Router();

router.post('/', eventsController.ingestEvent);

export default router;
