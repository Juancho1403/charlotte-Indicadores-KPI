import { Router } from 'express';
import * as reportsController from '../../controllers/submodulos/reports.controller.js';

const router = Router();

router.post('/export', reportsController.generateExport);
router.get('/jobs/:job_id', reportsController.getJobStatus);

export default router;
