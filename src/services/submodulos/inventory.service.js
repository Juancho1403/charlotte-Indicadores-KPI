import { prisma } from '../../db/client.js';
import { 
    fetchAllDpNoteItems, 
    fetchDpNotes,
    fetchComandas,
    fetchProducts,
    fetchInventoryItems 
} from '../consumers/externalConsumers.js';

/**
 * Obtener Pareto (Top Ventas)
 * Lógica: Agregar dp_note_items agrupando por product_id
 * Normalizar nombres de productos (lowercase, sin tildes) para evitar duplicados
 * Sumar quantity y subtotal
 * Marcar bandera is_champion = true para el item #1
 */
export const getPareto = async (filters = {}) => {
    const { limit = 10 } = filters;
    
    try {
        // 1. Fetch de datos (Sin filtros de fecha para traer todo)
        const [dpNoteItemsData, comandasData, productsData] = await Promise.all([
            fetchAllDpNoteItems({}),
            fetchComandas({ status: 'CLOSED' }),
            fetchProducts({})
        ]);

        const dpNoteItems = Array.isArray(dpNoteItemsData) ? dpNoteItemsData : (dpNoteItemsData?.data || []);
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
        const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        console.log(products)
        // 3. Mapeo de nombres de productos (Objeto simple)
        const productNames = {};
        products.forEach(p => {
            const id = String(p.id || p.product_id || '');
            if (id) productNames[id] = p.name || 'Producto sin nombre';
        });
        console.log("Product Names Map:", productNames);
        // 4. Acumulador principal (Objeto simple)
        const statsObj = {};

        // Función para procesar cada línea de venta
        const processItem = (id, name, qty, subtotal, date) => {
            const pid = String(id || '').trim();
            if (!pid || pid === 'undefined' || pid === 'null') return;

            // Si el producto no existe en nuestro acumulador, lo inicializamos
            if (!statsObj[pid]) {
                statsObj[pid] = {
                    product_id: pid,
                    name: productNames[pid] || `Producto ${pid}`,
                    revenue_generated: 0,
                    quantity_sold: 0,
                    last_sale_iso: null,      // ISO completo para comparaciones
                    last_sale_date: null,     // YYYY-MM-DD (salida actual)
                    last_sale_time: null      // HH:MM:SS (nueva clave solicitada)
                };
            }
            // Sumamos los valores asegurando que sean números
            statsObj[pid].revenue_generated += parseFloat(subtotal || 0);
            statsObj[pid].quantity_sold += parseFloat(qty || 0);
            // Actualizar la fecha más reciente (usa ISO para comparar y guardar fecha/hora por separado)
            if (date) {
                const saleDate = new Date(date);
                const iso = saleDate.toISOString();
                if (!statsObj[pid].last_sale_iso || iso > statsObj[pid].last_sale_iso) {
                    statsObj[pid].last_sale_iso = iso;
                    const [d, t] = iso.split('T');
                    const time = t.split('.')[0]; // HH:MM:SS
                    statsObj[pid].last_sale_date = d; 
                    statsObj[pid].last_sale_time = time;
                }
            }
        };
        
        // 5. Procesar comandas (para Pareto de productos)
        comandas.forEach(comanda => {
            const lines = comanda.lines || comanda.order_lines || [];
            const comandaDate = comanda.delivered_at || null; // Usar delivered_at como fecha
            if (Array.isArray(lines)) {
                lines.forEach(line => {
                    const price = parseFloat(line.price || 0);
                    const qty = parseFloat(line.qty || line.quantity || 0);
                    const productId = String(line.product_id || '');
                    const productName = productNames[productId] || `Producto ${productId}`;
                    processItem(productId, productName, qty, (price * qty), comandaDate);
                });
            }
        });

        // 6. Procesar órdenes de delivery/pickup (cada orden como un "producto" con su monto total)
        dpNoteItems.forEach(order => {
            const orderDate = order.timestamp_creation || order.date || null; // Mantener como estaba para dpNoteItems
            processItem(order.order_id, order.readable_id, 1, order.monto_total, orderDate);
        });
        
        // 7. Convertir el objeto a Array para ordenar
        const allProducts = Object.values(statsObj);

        if (allProducts.length === 0) {
            console.log("No se encontraron productos para procesar.");
            return { success: true, data: [] };
        }

        // Ordenar por ganancia de mayor a menor
        const sortedList = allProducts.sort((a, b) => b.revenue_generated - a.revenue_generated);

        // 8. Calcular Champion y Pareto
        const totalRevenue = sortedList.reduce((acc, curr) => acc + curr.revenue_generated, 0);
        let cumulativeSum = 0;

        const result = sortedList.slice(0, limit).map((item, index) => {
            cumulativeSum += item.revenue_generated;
            
            return {
                product_id: item.product_id,
                name: item.name,
                revenue_generated: Number(item.revenue_generated.toFixed(2)),
                quantity_sold: Number(item.quantity_sold),
                last_sale_date: item.last_sale_date,
                last_sale_time: item.last_sale_time, // <-- nueva clave con la hora (HH:MM:SS)
                // El primero de la lista (más vendido) es el Champion
                is_champion: index === 0,
                // Cálculo de porcentaje acumulado para la curva de la gráfica
                cumulative_percentage: totalRevenue > 0 
                    ? Number(((cumulativeSum / totalRevenue) * 100).toFixed(2)) 
                    : 0
            };
        });

        return {
            success: true,
            total_records: allProducts.length,
            total_revenue: totalRevenue,
            data: result
        };

    } catch (error) {
        console.error("Error en getPareto con Objetos:", error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Obtener Feed de Alertas de Stock
 * Lógica: Comparar current_level_pct (nivel actual) vs tabla dp_thresholds
 * Si el nivel es menor al umbral, generar objeto de alerta
 * Registrar evento en kpi_alerta_historial si la alerta es nueva
 */
export const getStockAlerts = async (filters) => {
    const { severity = 'ALL' } = filters;
    
    try {
        // 1. Obtener items de inventario
        const inventoryData = await fetchInventoryItems({});
        const items = Array.isArray(inventoryData) ? inventoryData : (inventoryData?.data || []);
        
        if (items.length === 0) {
            return { critical_count: 0, alerts: [] };
        }
        
        // 2. Obtener umbrales desde la base de datos (dp_thresholds)
        // Nota: Si no existe tabla dp_thresholds, usar valores por defecto
        let thresholds = {};
        try {
            // Intentar obtener umbrales desde Prisma si existe la tabla
            // Por ahora usamos valores por defecto
            thresholds = {
                WARNING: 20,  // 20% del stock mínimo
                CRITICAL: 10  // 10% del stock mínimo
            };
        } catch (e) {
            thresholds = { WARNING: 20, CRITICAL: 10 };
        }
        
        // 3. Filtrar items que requieren alerta
        const alerts = [];
        let criticalCount = 0;
        
        items.forEach(item => {
            const quantityOnHand = Number(item.quantity_on_hand || item.stock || 0);
            const reorderThreshold = Number(item.reorder_threshold || item.min_stock || 10);
            const currentLevelPct = reorderThreshold > 0 
                ? (quantityOnHand / reorderThreshold) * 100 
                : (item.current_level_pct || 0);
            
            let itemSeverity = null;
            if (currentLevelPct <= thresholds.CRITICAL) {
                itemSeverity = 'CRITICAL';
                criticalCount++;
            } else if (currentLevelPct <= thresholds.WARNING) {
                itemSeverity = 'WARNING';
            }
            
            // Solo incluir si cumple con el filtro de severity
            if (itemSeverity && (severity === 'ALL' || severity === itemSeverity)) {
                alerts.push({
                    item_name: item.name || 'Unknown Item',
                    current_level_pct: Math.round(currentLevelPct),
                    severity: itemSeverity,
                    action_required: "RESTOCK"
                });
            }
        });
        // 4. Ordenar por severity (CRITICAL primero) y luego por current_level_pct
        alerts.sort((a, b) => {
            if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
            if (a.severity !== 'CRITICAL' && b.severity === 'CRITICAL') return 1;
            return a.current_level_pct - b.current_level_pct;
        });
        // 5. Registrar alertas nuevas en kpi_alerta_historial (opcional)
        // Esto se puede hacer en un worker separado para no bloquear la respuesta
        return {
            critical_count: criticalCount,
            alerts: alerts.slice(0, 10) // Limitar a top 10
        };
        
    } catch (e) {
        console.warn("Error en getStockAlerts:", e);
        return { critical_count: 0, alerts: [] };
    }
};

export const getItemDetails = async (itemId) => {
    // TODO: Implementar detalle de item (Tarea futura)
    return { success: true, data: {} };
};