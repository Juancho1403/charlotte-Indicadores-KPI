import { Router } from 'express';
import dashboardRoutes from './dashboard.routes.js';
import operationsRoutes from './operations.routes.js';
import inventoryRoutes from './inventory.routes.js';
import configurationRoutes from './configuration.routes.js';
import reportsRoutes from './reports.routes.js';
import chartsRoutes from './charts.routes.js';

const router = Router();

router.use('/dashboard', dashboardRoutes);
router.use('/operations', operationsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/configuration', configurationRoutes);
router.use('/reports', reportsRoutes);
router.use('/charts', chartsRoutes);

export default router;
