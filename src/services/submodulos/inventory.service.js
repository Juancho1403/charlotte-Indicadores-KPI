import { match } from 'assert';
import { prisma } from '../../db/client.js';
import { 
    fetchAllDpNoteItems, 
    fetchDpNotes,
    fetchComandas,
    fetchProducts,
    fetchProductById,
    fetchInventoryItems 
} from '../consumers/externalConsumers.js';

/**
 * Extraer ID de producto desde product_name con formato "Producto #id"
 * @param {string} productName - Nombre del producto (ej: "Producto #9ef55f08-25b0-43d5-afd7-d8daa76ef7b1")
 * @returns {string|null} ID del producto o null si no coincide el formato
 */
const extractProductIdFromName = (productName) => {
    const match = productName.match(/^Producto #([a-f0-9-]+)$/i);
    return match ? match[1] : null;
};

/**
 * Obtener nombres reales de productos para comandas con formato "Producto #id"
 * @param {Array} comandas - Lista de comandas
 * @returns {Object} Objeto con mapeo de ID -> nombre de producto
 */
const fetchProductNamesForComandas = async (comandas) => {
    const productIds = new Set();
    const productMap = {};
    
    // Extraer IDs únicos de las comandas
    comandas.forEach(comanda => {
        const lines = comanda.items || comanda.order_lines || [];
        if (Array.isArray(lines)) {
            lines.forEach(line => {
                const productId = extractProductIdFromName(line.product_name);
                if (productId) {
                    productIds.add(productId);
                }
            });
        }
    });
    
    // Fetch de productos en paralelo
    if (productIds.size > 0) {
        const productPromises = Array.from(productIds).map(async (id) => {
            try {
                const product = await fetchProductById(id);
                return { id, name: product?.name || `Producto ${id}` };
            } catch (error) {
                console.warn(`Error fetching product ${id}:`, error.message);
                return { id, name: `Producto ${id}` };
            }
        });
        
        const productResults = await Promise.all(productPromises);
        productResults.forEach(({ id, name }) => {
            productMap[id] = name;
        });
    }
    
    return productMap;
};

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
        const [comandasData, productsData] = await Promise.all([
            fetchComandas({ status: 'CLOSED' }),
            fetchProducts({})
        ]);

        //const dpNoteItems = Array.isArray(dpNoteItemsData) ? dpNoteItemsData : (dpNoteItemsData?.data || []);
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
        const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        
        // 2. Primero verificar qué IDs coinciden antes de hacer peticiones
        console.log('\n🔍 Verificando coincidencias de IDs antes de obtener nombres...');
        const productIds = new Set();
        products.forEach(p => {
            const id = String(p.id || p.product_id || '');
            if (id && id !== 'undefined' && id !== 'null') {
                productIds.add(id);
            }
        });
        
        const comandaItemIds = new Set();
        const comandaItemsWithExtractedIds = [];
        
        comandas.forEach(comanda => {
            const lines = comanda.items || comanda.order_lines || [];
            if (Array.isArray(lines)) {
                lines.forEach(line => {
                    let productId = String(line.product_id || '');
                    const extractedId = extractProductIdFromName(line.product_name || '');
                    if (extractedId) {
                        productId = extractedId;
                    }
                    if (productId && productId !== 'undefined' && productId !== 'null') {
                        comandaItemIds.add(productId);
                        comandaItemsWithExtractedIds.push({
                            ...line,
                            comanda_id: comanda.id,
                            final_product_id: productId
                        });
                    }
                });
            }
        });
        
        const matchingIds = [...comandaItemIds].filter(id => productIds.has(id));
        const nonMatchingIds = [...comandaItemIds].filter(id => !productIds.has(id));
        const matchPercentage = comandaItemIds.size > 0 
            ? ((matchingIds.length / comandaItemIds.size) * 100).toFixed(2)
            : 0;
            
        console.log(`📊 Verificación de IDs: ${matchingIds.length}/${comandaItemIds.size} coinciden (${matchPercentage}%)`);
        
        // Mostrar IDs que coinciden
        if (matchingIds.length > 0) {
            console.log('✅ IDs que coinciden:');
            matchingIds.forEach(id => {
                const product = products.find(p => String(p.id || p.product_id) === id);
                console.log(`  - ID: ${id} -> ${product?.name || 'Producto sin nombre'}`);
            });
        }
        
        if (nonMatchingIds.length > 0) {
            console.log(`⚠️  Hay ${nonMatchingIds.length} IDs en comandas que no existen en products`);
        }
        console.log('');
        
        // 2.1. Obtener nombres reales SOLO para los IDs que coinciden
        const comandaProductNames = {};
        if (matchingIds.length > 0) {
            console.log(`🔄 Obteniendo nombres reales para ${matchingIds.length} productos que coinciden...`);
            const productPromises = matchingIds.map(async (id) => {
                try {
                    const product = await fetchProductById(id);
                    return { id, name: product?.data.name || `Producto ${id}` };
                } catch (error) {
                    console.warn(`Error fetching product ${id}:`, error.message);
                    return { id, name: `Producto ${id}` };
                }
            });
            
            const productResults = await Promise.all(productPromises);
            productResults.forEach(({ id, name }) => {
                comandaProductNames[id] = name;
            });
            console.log('✅ Nombres obtenidos exitosamente\n');
        } else {
            console.log('⚠️  No hay IDs coincidentes para obtener nombres\n');
        }

        // 3. Mapeo de nombres de productos (Objeto simple)
        const productNames = {};
        const productPrices = {}; // Nuevo mapeo de precios
        products.forEach(p => {
            const id = String(p.id || p.product_id || '');
            if (id) {
                productNames[id] = p.name || 'Producto sin nombre';
                productPrices[id] = p.basePrice || p.base_price || 0; // Guardar precio base
            }
        });
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
                    name: name || `Producto ${pid}`, // Solo establecer nombre si es nuevo
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
        
        // 5. Procesar comandas (para Pareto de productos) - SOLO los que coinciden
        let processedItems = 0;
        let skippedItems = 0;
        
        comandas.forEach(comanda => {
            const lines = comanda.items || comanda.order_lines || [];
            
            // Determinar la fecha según el estado
            let comandaDate = null;
            if (comanda.status === 'PENDING') {
                comandaDate = comanda.sent_at || null;
            } else if (comanda.status === 'DELIVERED') {
                comandaDate = comanda.delivered_at || null;
            }
            if (Array.isArray(lines)) {
                lines.forEach(line => {
                    const qty = parseFloat(line.qty || line.quantity || 0);
                    let productId = String(line.product_id || '');
                    let productName = line.product_name || '';
                    
                    // Si el product_name tiene formato "Producto #id", extraer el ID
                    const extractedId = extractProductIdFromName(productName);
                    if (extractedId) {
                        productId = extractedId;
                    }
                    
                    // VERIFICAR SI EL PRODUCTO EXISTE EN comandaProductNames (solo los que coinciden)
                    if (comandaProductNames[productId]) {
                        // El producto existe, usar el nombre real
                        productName = comandaProductNames[productId];
                        
                        // Obtener precio base desde productos
                        const basePrice = productPrices[productId] || 0;
                        const calculatedSubtotal = basePrice * qty;
                        processItem(productId, productName, qty, calculatedSubtotal, comandaDate);
                        processedItems++;
                    } else {
                        // El producto NO existe en el listado de coincidencias, omitir
                        skippedItems++;
                    }
                });
            }
        });
        
        console.log(`📈 Procesamiento de comandas: ${processedItems} items procesados, ${skippedItems} items omitidos (no coinciden)`);
        
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

/**
 * Verificar coincidencias de IDs entre products y comandas.items
 * Muestra por consola los productos que coinciden y los que no
 */
export const checkProductIdMatches = async () => {
    try {
        console.log('🔍 Verificando coincidencias de IDs entre products y comandas.items...\n');
        
        // Obtener datos
        const [productsData, comandasData] = await Promise.all([
            fetchProducts({}),
            fetchComandas({ status: 'CLOSED' })
        ]);
        
        const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
        
        // Crear conjunto de IDs de productos
        const productIds = new Set();
        products.forEach(product => {
            const id = String(product.id || product.product_id || '');
            if (id && id !== 'undefined' && id !== 'null') {
                productIds.add(id);
            }
        });
        
        // Recolectar todos los IDs de comandas.items
        const comandaItemIds = new Set();
        const comandaItemsDetails = [];
        
        comandas.forEach(comanda => {
            const lines = comanda.items || comanda.order_lines || [];
            if (Array.isArray(lines)) {
                lines.forEach(line => {
                    let productId = String(line.product_id || '');
                    
                    // Si el product_name tiene formato "Producto #id", extraer el ID
                    const extractedId = extractProductIdFromName(line.product_name || '');
                    if (extractedId) {
                        productId = extractedId;
                    }
                    
                    if (productId && productId !== 'undefined' && productId !== 'null') {
                        comandaItemIds.add(productId);
                        comandaItemsDetails.push({
                            product_id: productId,
                            product_name: line.product_name,
                            comanda_id: comanda.id,
                            qty: line.qty || line.quantity
                        });
                    }
                });
            }
        });
        
        // Analizar coincidencias
        const matchingIds = [...comandaItemIds].filter(id => productIds.has(id));
        const nonMatchingIds = [...comandaItemIds].filter(id => !productIds.has(id));
        
        // Mostrar resultados por consola
        console.log('📊 RESULTADOS DE LA VERIFICACIÓN:');
        console.log('=====================================');
        console.log(`Total productos en BD: ${productIds.size}`);
        console.log(`Total items en comandas: ${comandaItemIds.size}`);
        console.log(`IDs que coinciden: ${matchingIds.length}`);
        console.log(`IDs que NO coinciden: ${nonMatchingIds.length}\n`);
        
        if (matchingIds.length > 0) {
            console.log('✅ IDs QUE COINCIDEN:');
            matchingIds.forEach(id => {
                const product = products.find(p => String(p.id || p.product_id) === id);
                const comandaItems = comandaItemsDetails.filter(item => item.product_id === id);
                console.log(`  - ID: ${id}`);
                console.log(`    Producto: ${product?.name || 'N/A'}`);
                console.log(`    Aparece en ${comandaItems.length} comandas`);
            });
            console.log('');
        }
        
        if (nonMatchingIds.length > 0) {
            console.log('❌ IDS QUE NO COINCIDEN:');
            nonMatchingIds.forEach(id => {
                const comandaItems = comandaItemsDetails.filter(item => item.product_id === id);
                console.log(`  - ID: ${id}`);
                console.log(`    Aparece en ${comandaItems.length} comandas`);
                console.log(`    Ejemplo de producto en comanda: "${comandaItems[0]?.product_name || 'N/A'}"`);
            });
            console.log('');
        }
        
        // Estadísticas finales
        const matchPercentage = comandaItemIds.size > 0 
            ? ((matchingIds.length / comandaItemIds.size) * 100).toFixed(2)
            : 0;
            
        console.log('📈 ESTADÍSTICAS FINALES:');
        console.log('========================');
        console.log(`Porcentaje de coincidencia: ${matchPercentage}%`);
        console.log(`Productos sin correspondencia: ${nonMatchingIds.length}/${comandaItemIds.size}`);
        
        return {
            success: true,
            stats: {
                total_products: productIds.size,
                total_comanda_items: comandaItemIds.size,
                matching_ids: matchingIds.length,
                non_matching_ids: nonMatchingIds.length,
                match_percentage: parseFloat(matchPercentage)
            },
            matching_ids: matchingIds,
            non_matching_ids: nonMatchingIds
        };
        
    } catch (error) {
        console.error('❌ Error en checkProductIdMatches:', error.message);
        return { success: false, error: error.message };
    }
};