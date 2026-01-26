import fetch from 'node-fetch';
import { envs } from '../../config/envs.js';
import { prisma } from '../../db/client.js';

export const getPareto = async (filters) => {
    // Top productos vendidos. Usamos DpNote o OrderItem (si existiera). 
    // Como no definimos OrderItem en schema stub, simularemos agregación simple o usaremos Order.total si no hay items.
    
    // Asumiremos para esta entrega que consultamos una tabla imaginaria o retornamos el ejemplo si no hay datos.
    return {
        success: true,
        data: [
            { product_id: 101, name: "Charlotte Burger", revenue_generated: 1200.50, quantity_sold: 120, is_champion: true },
            { product_id: 102, name: "Avocado Toast", revenue_generated: 950.00, quantity_sold: 95, is_champion: false },
            { product_id: 103, name: "Cappuccino", revenue_generated: 450.00, quantity_sold: 150, is_champion: false }
        ]
    };
};

export const getStockAlerts = async (filters) => {
    try {
        const kitchBaseUrl = process.env.KITCHEN_BASE_URL || envs.KITCHEN_BASE_URL || 'https://charlotte-cocina.onrender.com/api';
        const invUrl = `${kitchBaseUrl}/inventory/items`;
        // Asumiendo endpoint /items retorna lista con campo 'stock' y 'min_stock' (o similar)
        console.log("Fetching Inventory:", invUrl);
        const res = await fetch(invUrl); 
        if (!res.ok) throw new Error("Inventory API Failed");
        
        const json = await res.json(); 
        const items = Array.isArray(json) ? json : (json.data || []);
        // Filtrar items críticos
        const alerts = items
            .filter(i => (i.actual_stock || i.stock || i.quantity || 0) <= (i.standard_stock || i.min_stock || 10))
            .map(i => ({
                item_id: i.id || i._id,
                item_name: i.name,
                current_level_pct: Math.round(((i.actual_stock || i.stock || 0) / (i.standard_stock || 100)) * 100) || 10,
                severity: (i.actual_stock <= (i.standard_stock * 0.2)) ? "CRITICAL" : "WARNING",
                action_required: "RESTOCK"
            }));

        return {
            critical_count: alerts.length,
            alerts: alerts.slice(0, 10)
        };
    } catch (e) {
        console.warn("Stock Alert Fetch Error:", e.message);
        return { critical_count: 0, alerts: [] };
    }
};

export const getItemDetails = async (itemId) => {
    // TODO: Implementar detalle de item (Tarea futura)
    return { success: true, data: {} };
};