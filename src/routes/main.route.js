import { Router } from 'express';

// Importar rutas de submódulos
import dashboardRoutes from './submodulos/dashboard.route.js';
import operationsRoutes from './submodulos/operations.route.js';
import inventoryRoutes from './submodulos/inventory.route.js';
import configurationRoutes from './submodulos/configuration.route.js';
import reportsRoutes from './submodulos/reports.route.js';
import alertsRoutes from './submodulos/alerts.route.js';
import eventsRoutes from './submodulos/events.route.js';
import analyticsRoutes from './submodulos/analytics.route.js';
import webhooksRoutes from './submodulos/webhooks.route.js';

const router = Router();

// Rutas Públicas / Generales (si las hubiera)
router.get('/health', (req, res) => {
    res.json({ status: 'KPI Module OK', timestamp: new Date() });
});

// Rutas Protegidas / Submódulos
// Prefijo Base definido en index.js: /api/v1/kpi

router.use('/dashboard', dashboardRoutes);
router.use('/operations', operationsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/configuration', configurationRoutes);
router.use('/reports', reportsRoutes);
router.use('/alerts', alertsRoutes);
router.use('/events', eventsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhooksRoutes);

export default router;
