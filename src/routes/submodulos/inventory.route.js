import { Router } from 'express';
import * as inventoryController from '../../controllers/submodulos/inventory.controller.js';

const router = Router();
// GET /kpi/inventory/pareto 
/**
 * @swagger
 * /api/v1/kpi/inventory/pareto:
 *   get:
 *     summary: Análisis de Pareto (Productos que generan el 80% de ventas)
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Lista de productos estrella identificados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       product_id: { type: string, example: "PRD-01" }
 *                       name: { type: string, example: "Hamburguesa Charlotte" }
 *                       revenue_generated: { type: number, example: 4500.50 }
 */
router.get('/pareto', inventoryController.getPareto);

/**
 * @swagger
 * /api/v1/kpi/inventory/alerts:
 *   get:
 *     summary: Alertas de stock bajo en tiempo real
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Lista de insumos con stock crítico.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 critical_count: { type: integer, example: 3 }
 *                 alerts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryAlert'
 */
router.get('/alerts', inventoryController.getAlerts);

/**
 * @swagger
 * /api/v1/kpi/inventory/items/{item_id}:
 *   get:
 *     summary: Detalle histórico de un ítem de inventario
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: item_id
 *         required: true
 *         schema:
 *           type: string
 *         example: "ITEM-505"
 *     responses:
 *       200:
 *         description: Logs y métricas detalladas del ítem.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryAlert'
 */
router.get('/items/:item_id', inventoryController.getItemDetails);

export default router;
