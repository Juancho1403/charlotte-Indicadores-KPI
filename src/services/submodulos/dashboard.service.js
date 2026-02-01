import { prisma } from '../../db/client.js';
import { isSameUtcDate, minutesBetween } from "../../utils/timeHelpers.js";
import { 
    fetchComandas, 
    fetchDpNotes, 
    fetchClienteTemporal,
    fetchMesas,
    fetchProducts,
    fetchProductById
} from '../consumers/externalConsumers.js';

/**
 * Extraer ID de producto desde product_name con formato "Producto #id"
 */
const extractProductIdFromName = (productName) => {
    const match = productName.match(/^Producto #([a-f0-9-]+)$/i);
    return match ? match[1] : null;
};

export const getSummary = async (filters) => {
    const { date, force_refresh, store_id } = filters;
    const targetDate = date ? new Date(date) : new Date();
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    let totalRevenue = 0;
    let totalOrders = 0;

    // Variables para ticket promedio y distribución por estados
    let revenueByStatus = {
        DELIVERED: 0,
        PENDING: 0,
        CANCELLED: 0
    };
    let ordersByStatus = {
        DELIVERED: 0,
        PENDING: 0,
        CANCELLED: 0
    };

    // 5. Meta y Proyección Trimestral - obtener primero para saber el rango
    const meta = await prisma.kpiMeta.findFirst({
        where: { activa: true, fechaInicio: { lte: targetDate }, fechaFin: { gte: targetDate } }
    });
    const target = Number(meta?.montoObjetivo || 450000);
    let quarterlyStartDate;
    if (meta?.fechaInicio) {
        quarterlyStartDate = meta.fechaInicio;
    } else {
        // Si no hay fecha de inicio definida, tomar hace un trimestre (3 meses)
        quarterlyStartDate = new Date(targetDate);
        quarterlyStartDate.setMonth(quarterlyStartDate.getMonth() - 3);
    }
    const quarterlyStartDateStr = quarterlyStartDate.toISOString().slice(0, 10);

    // 1. Fetch Comandas cerradas de Atención al Cliente (Sala) - obtener todas y filtrar por rango trimestral
    try {
        console.log("Fetching Comandas from ATC for quarterly range:", quarterlyStartDateStr, "to", targetDateStr);
        const [comandasData, productsData] = await Promise.all([
            fetchComandas({ 
                date_from: quarterlyStartDateStr, 
                date_to: targetDateStr,
                status: 'CLOSED' 
            }),
            fetchProducts({})
        ]);
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
        const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        
        // Crear mapeo de precios base de productos
        const productPrices = {};
        products.forEach(p => {
            const id = String(p.id || p.product_id || '');
            if (id) {
                productPrices[id] = p.basePrice || p.base_price || 0;
            }
        });
        
        // Filtrar por rango de fechas y estado
        const filtered = comandas.filter(c => {
            const createdDate = c.delivered_at || c.sent_at  || c.timestamp_creation || '';
            const date = new Date(createdDate);
            return date >= quarterlyStartDate && date <= targetDate && 
                   createdDate.toString().slice(0, 10) >= quarterlyStartDateStr &&
                   createdDate.toString().slice(0, 10) <= targetDateStr;
        });
        
        // Procesar cada comanda para calcular revenue con precios base
        for (const c of filtered) {
            const status = c.status?.toUpperCase();
            let comandaRevenue = 0;
            let hasValidItems = false;
            
            const lines = c.items || c.order_lines || [];
            if (Array.isArray(lines)) {
                for (const line of lines) {
                    const qty = parseFloat(line.qty || line.quantity || 0);
                    let productId = String(line.product_id || '');
                    
                    // Si el product_name tiene formato "Producto #id", extraer el ID
                    const extractedId = extractProductIdFromName(line.product_name || '');
                    if (extractedId) {
                        productId = extractedId;
                    }
                    
                    // Obtener precio base del producto
                    let basePrice = 0;
                    if (productId && productPrices[productId]) {
                        basePrice = productPrices[productId];
                    } else if (productId) {
                        // Si no está en el mapeo, intentar obtenerlo individualmente
                        try {
                            const product = await fetchProductById(productId);
                            basePrice = product?.data?.basePrice || product?.data?.base_price || 0;
                            productPrices[productId] = basePrice; // Cache
                        } catch (error) {
                            console.warn(`Error fetching product ${productId}:`, error.message);
                            basePrice = 0;
                        }
                    }
                    
                    // Calcular subtotal usando precio base
                    const subtotal = basePrice * qty;
                    comandaRevenue += subtotal;
                    hasValidItems = true;
                }
            }
            
            // Si no hay items con precios válidos, usar el total original como fallback
            if (!hasValidItems) {
                comandaRevenue = Number(c.total || c.monto_total || 0);
            }
            
            // Clasificar por estado
            if (status === 'DELIVERED') {
                revenueByStatus.DELIVERED += comandaRevenue;
                ordersByStatus.DELIVERED++;
            } else if (status === 'PENDING' || status === 'PENDING_REVIEW' || status === 'IN_KITCHEN') {
                revenueByStatus.PENDING += comandaRevenue;
                ordersByStatus.PENDING++;
            } else if (status === 'CANCELLED' || status === 'CANCELED') {
                revenueByStatus.CANCELLED += comandaRevenue;
                ordersByStatus.CANCELLED++;
            }
            
            totalRevenue += comandaRevenue;
            totalOrders++;
        }
    } catch (e) { 
        console.warn("Error fetching Comandas from ATC:", e.message); 
    }

    // 2. Fetch dp_notes de Delivery/Pickup - obtener todos y filtrar por rango trimestral
    try {
        console.log("Fetching dp_notes from Delivery for quarterly range:", quarterlyStartDateStr, "to", targetDateStr);
        const dpNotesData = await fetchDpNotes({ 
            date_from: quarterlyStartDateStr, 
            date_to: targetDateStr 
        });
        const dpNotes = Array.isArray(dpNotesData) ? dpNotesData : (dpNotesData?.data || []);
        
        dpNotes.forEach(note => {
            // Filtrar por rango de fechas y excluir canceladas
            const noteDate = note.created_at || note.timestamp_creation || '';
            const date = new Date(noteDate);
            if (date >= quarterlyStartDate && date <= targetDate && 
                noteDate.toString().slice(0, 10) >= quarterlyStartDateStr &&
                noteDate.toString().slice(0, 10) <= targetDateStr) {
                
                const revenue = Number(note.monto_total || note.total_amount || 0);
                const status = (note.current_status || note.status)?.toUpperCase();
                
                // Clasificar por estado
                if (status === 'DELIVERED') {
                    revenueByStatus.DELIVERED += revenue;
                    ordersByStatus.DELIVERED++;
                } else if (status === 'PENDING' || status === 'PENDING_REVIEW' || status === 'IN_KITCHEN' || status === 'EN_ROUTE') {
                    revenueByStatus.PENDING += revenue;
                    ordersByStatus.PENDING++;
                } else if (status === 'CANCELLED' || status === 'CANCELED') {
                    revenueByStatus.CANCELLED += revenue;
                    ordersByStatus.CANCELLED++;
                }
                
                totalRevenue += revenue;
                totalOrders++;
            }
        });
    } catch (e) { 
        console.warn("Error fetching dp_notes from Delivery:", e.message); 
    }

    // Calcular porcentaje de cambio con respecto al día anterior
    let changePercentage = 0;
    let trendDirection = "flat";
    try {
        const previousDate = new Date(targetDate);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousDateStr = previousDate.toISOString().slice(0, 10);
        
        let previousRevenue = 0;
        
        // Obtener comandas del día anterior
        try {
            const previousComandasData = await fetchComandas({ date: previousDateStr, status: 'CLOSED' });
            const previousComandas = Array.isArray(previousComandasData) ? previousComandasData : (previousComandasData?.data || []);
            
            previousComandas.forEach(c => {
                if (c.status !== 'CANCELLED' && c.status !== 'CANCELED') {
                    previousRevenue += Number(c.total || c.monto_total || 0);
                }
            });
        } catch (e) {
            console.warn("Error fetching previous comandas:", e.message);
        }
        
        // Obtener delivery del día anterior
        try {
            const previousDpNotesData = await fetchDpNotes({ date: previousDateStr });
            const previousDpNotes = Array.isArray(previousDpNotesData) ? previousDpNotesData : (previousDpNotesData?.data || []);
            
            previousDpNotes.forEach(note => {
                if (note.status !== 'CANCELLED' && note.status !== 'CANCELED') {
                    previousRevenue += Number(note.monto_total || note.total_amount || 0);
                }
            });
        } catch (e) {
            console.warn("Error fetching previous dp_notes:", e.message);
        }
        
        // Calcular porcentaje de cambio
        if (previousRevenue > 0) {
            changePercentage = ((totalRevenue - previousRevenue) / previousRevenue) * 100;
            trendDirection = changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'flat';
        }
    } catch (e) {
        console.warn("Error calculating change percentage:", e.message);
    }

    // 3. Calcular tiempo promedio de servicio desde cliente_temporal
    // Lógica: AVG(closedAt - createdAt) de cliente_temporal, excluir outliers > 3σ o > 240 min
    let avgServiceTimeMinutes = 0;
    let avgServiceTimeFormatted = "00:00";
    try {
        const clienteTemporalData = await fetchClienteTemporal({ date: targetDateStr });
        const clientes = Array.isArray(clienteTemporalData) ? clienteTemporalData : (clienteTemporalData?.data || []);
        
        const serviceTimes = [];
        clientes.forEach(c => {
            if (c.closed_at || c.closedAt) {
                const createdAt = new Date(c.created_at || c.createdAt);
                const closedAt = new Date(c.closed_at || c.closedAt);
                const minutes = minutesBetween(createdAt, closedAt);
                
                // Excluir outliers: > 240 min (4 horas) o valores inválidos
                if (minutes > 0 && minutes <= 240) {
                    serviceTimes.push(minutes);
                }
            }
        });
        
        if (serviceTimes.length > 0) {
            // Calcular promedio
            avgServiceTimeMinutes = serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length;
            
            // Formatear como "MM:SS"
            const mins = Math.floor(avgServiceTimeMinutes);
            const secs = Math.floor((avgServiceTimeMinutes - mins) * 60);
            avgServiceTimeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
    } catch (e) { 
        console.warn("Error calculating avg service time:", e.message); 
    }

    // 4. Calcular rotación de mesas
    // Fórmula: (clientes_unicos / mesas_activas) / horas_operativas
    let tableRotation = 0;
    try {
        const mesasData = await fetchMesas({ date: targetDateStr });
        const mesas = Array.isArray(mesasData) ? mesasData : (mesasData?.data || []);
        const mesasActivas = mesas.filter(m => m.status === 'OCCUPIED' || m.status === 'AVAILABLE').length;
        
        const clienteTemporalData = await fetchClienteTemporal({ date: targetDateStr });
        const clientes = Array.isArray(clienteTemporalData) ? clienteTemporalData : (clienteTemporalData?.data || []);
        const clientesUnicos = new Set(clientes.map(c => c.mesa_id || c.table_id)).size;
        
        // Asumir 8 horas operativas por defecto
        const horasOperativas = 8;
        if (mesasActivas > 0) {
            tableRotation = (clientesUnicos / mesasActivas) / horasOperativas;
        }
    } catch (e) { 
        console.warn("Error calculating table rotation:", e.message); 
    }

    // Para quarterly goal, acumulado desde inicio del trimestre hasta la fecha pedida
    const acumulado = totalRevenue;
    const progressPct = target > 0 ? (acumulado / target) * 100 : 0;

    // 6. Determinar UI Status basado en umbrales (dp_thresholds)
    // Por ahora usamos valores por defecto
    const timeStatus = avgServiceTimeMinutes <= 5 ? "OPTIMAL" : 
                      avgServiceTimeMinutes <= 10 ? "WARNING" : "CRITICAL";
    const rotationStatus = tableRotation >= 1.0 ? "OPTIMAL" : 
                          tableRotation >= 0.5 ? "WARNING" : "CRITICAL";
    const goalStatus = progressPct >= 80 ? "ON_TRACK" : 
                       progressPct >= 50 ? "AT_RISK" : "OFF_TRACK";

    // 7. Calcular ticket promedio y distribución por estados
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Calcular distribución porcentual por estados - usar totalRevenue como base para que coincida
    const statusDistribution = {
        DELIVERED: {
            revenue: revenueByStatus.DELIVERED,
            orders: ordersByStatus.DELIVERED,
            percentage: totalRevenue > 0 ? (revenueByStatus.DELIVERED / totalRevenue) * 100 : 0
        },
        PENDING: {
            revenue: revenueByStatus.PENDING,
            orders: ordersByStatus.PENDING,
            percentage: totalRevenue > 0 ? (revenueByStatus.PENDING / totalRevenue) * 100 : 0
        },
        CANCELLED: {
            revenue: revenueByStatus.CANCELLED,
            orders: ordersByStatus.CANCELLED,
            percentage: totalRevenue > 0 ? (revenueByStatus.CANCELLED / totalRevenue) * 100 : 0
        }
    };

    // Verificar que la suma de ganancias por categoría coincida con el total
    const totalByCategories = revenueByStatus.DELIVERED + revenueByStatus.PENDING + revenueByStatus.CANCELLED;
    console.log("=== VERIFICACIÓN DE GANANCIAS ===");
    console.log("Total Revenue:", totalRevenue);
    console.log("Suma por categorías:", totalByCategories);
    console.log("¿Coinciden?", totalRevenue === totalByCategories ? "✅ SÍ" : "❌ NO");
    console.log("DELIVERED:", revenueByStatus.DELIVERED);
    console.log("PENDING:", revenueByStatus.PENDING);
    console.log("CANCELLED:", revenueByStatus.CANCELLED);
    console.log("===============================");

    return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
            revenue: {
                total: totalRevenue,
                currency: "USD",
                trend_percentage: parseFloat(changePercentage.toFixed(1)),
                trend_direction: trendDirection,
                average_ticket: parseFloat(averageTicket.toFixed(2)),
                status_distribution: statusDistribution
            },
            quarterly_goal: {
                target,
                current: acumulado,
                progress_percentage: parseFloat(progressPct.toFixed(1)),
                ui_status: goalStatus
            },
            operations: {
                avg_service_time: avgServiceTimeFormatted,
                time_status: timeStatus,
                table_rotation: parseFloat(tableRotation.toFixed(2)),
                rotation_status: rotationStatus
            }
        }
    };
};

export const getSummaryRange = async (filters) => {
    const { period, date_from, date_to } = filters;
    
    let startDate, endDate, isHourlyAnalysis = false;
    
    // Determinar rango de fechas según los parámetros
    if (date_from && date_to) {
        // Rango de fechas específico
        startDate = new Date(date_from);
        endDate = new Date(date_to);
        
        // Si es un solo día, analizar por horas
        if (date_from === date_to) {
            isHourlyAnalysis = true;
        }
    } else if (period) {
        // Período predefinido (día, semana, mes, año)
        endDate = new Date();
        startDate = new Date();
        
        switch (period.toLowerCase()) {
            case 'day':
                // Para día, usar solo el día actual
                startDate = new Date();
                endDate = new Date();
                isHourlyAnalysis = true; // Análisis por horas para períodos de día
                break;
            case 'week':
                startDate.setDate(endDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(endDate.getMonth() - 1);
                break;
            case 'year':
                startDate.setFullYear(endDate.getFullYear() - 1);
                break;
            default:
                // Si no se reconoce el período, usar última semana
                startDate.setDate(endDate.getDate() - 7);
        }
    } else {
        // Sin parámetros, devolver todos los datos (último mes por defecto)
        endDate = new Date();
        startDate = new Date();
        startDate.setMonth(endDate.getMonth() - 1);
    }
    
    // Asegurar que las fechas estén en formato ISO para la API
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);
    
    console.log(`Fetching data from ${startDateStr} to ${endDateStr}, hourly: ${isHourlyAnalysis}`);
    
    let dataStructure;
    
    if (isHourlyAnalysis) {
        // Para análisis por horas, usar estructura de 24 horas
        dataStructure = {};
        for (let i = 0; i < 24; i++) {
            dataStructure[i] = { revenue: 0, orders: 0 };
        }
    } else {
        // Para análisis por días, usar estructura diaria
        dataStructure = {};
    }
    
    // Obtener datos de comandas
    try {
        const [comandasData, productsData] = await Promise.all([
            fetchComandas({ 
                date_from: startDateStr, 
                date_to: endDateStr
            }),
            fetchProducts({})
        ]);
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
        const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        
        // Crear mapeo de precios base de productos
        const productPrices = {};
        products.forEach(p => {
            const id = String(p.id || p.product_id || '');
            if (id) {
                productPrices[id] = p.basePrice || p.base_price || 0;
            }
        });
        
        // Procesar cada comanda para calcular revenue con precios base
        for (const comanda of comandas) {
            // Incluir comandas en estados DELIVERED, PENDING y CANCELLED
            // Usar sent_at para PENDING y CANCELLED, delivered_at para DELIVERED
            const isValidStatus = comanda.status === 'DELIVERED' || 
                                comanda.status === 'PENDING' || 
                                comanda.status === 'CANCELLED' || 
                                comanda.status === 'CANCELED';
            
            if (isValidStatus) {
                let date;
                let comandaRevenue = 0;
                let hasValidItems = false;
                
                if (comanda.status === 'DELIVERED' && comanda.delivered_at) {
                    date = new Date(comanda.delivered_at);
                } else if ((comanda.status === 'PENDING' || comanda.status === 'CANCELLED' || comanda.status === 'CANCELED') && comanda.sent_at) {
                    date = new Date(comanda.sent_at);
                }
                
                // Calcular revenue usando precios base de productos
                const lines = comanda.items || comanda.order_lines || [];
                if (Array.isArray(lines)) {
                    for (const line of lines) {
                        const qty = parseFloat(line.qty || line.quantity || 0);
                        let productId = String(line.product_id || '');
                        
                        // Si el product_name tiene formato "Producto #id", extraer el ID
                        const extractedId = extractProductIdFromName(line.product_name || '');
                        if (extractedId) {
                            productId = extractedId;
                        }
                        
                        // Obtener precio base del producto
                        let basePrice = 0;
                        if (productId && productPrices[productId]) {
                            basePrice = productPrices[productId];
                        } else if (productId) {
                            // Si no está en el mapeo, intentar obtenerlo individualmente
                            try {
                                const product = await fetchProductById(productId);
                                basePrice = product?.data?.basePrice || product?.data?.base_price || 0;
                                productPrices[productId] = basePrice; // Cache
                            } catch (error) {
                                console.warn(`Error fetching product ${productId}:`, error.message);
                                basePrice = 0;
                            }
                        }
                        
                        // Calcular subtotal usando precio base
                        const subtotal = basePrice * qty;
                        comandaRevenue += subtotal;
                        hasValidItems = true;
                    }
                }
                
                // Si no hay items con precios válidos, usar el total original como fallback
                if (!hasValidItems) {
                    comandaRevenue = Number(comanda.total || 0);
                }
                
                // Filtrar por rango de fechas
                if (date && date >= startDate && date <= endDate) {
                    if (isHourlyAnalysis) {
                        // Agrupar por hora del día
                        const hour = date.getHours();
                        dataStructure[hour].revenue += comandaRevenue;
                        dataStructure[hour].orders += 1;
                    } else {
                        // Agrupar por día
                        const dateStr = date.toISOString().slice(0, 10);
                        if (!dataStructure[dateStr]) {
                            dataStructure[dateStr] = { revenue: 0, orders: 0 };
                        }
                        dataStructure[dateStr].revenue += comandaRevenue;
                        dataStructure[dateStr].orders += 1;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Error fetching comandas:", e.message);
    }
    
    // Obtener datos de delivery/pickup
    try {
        const dpNotesData = await fetchDpNotes({ 
            date_from: startDateStr, 
            date_to: endDateStr 
        });
        const dpNotes = Array.isArray(dpNotesData) ? dpNotesData : (dpNotesData?.data || []);
        
        dpNotes.forEach(note => {
            // Incluir pedidos en estados EN_ROUTE, PENDING_REVIEW, IN_KITCHEN y CANCELLED
            // Además de los estados que ya se incluían
            const isValidStatus = note.current_status === 'EN_ROUTE' || 
                                note.current_status === 'PENDING_REVIEW' || 
                                note.current_status === 'IN_KITCHEN' || 
                                note.current_status === 'CANCELLED' || 
                                note.current_status === 'CANCELED' ||
                                note.current_status === 'DELIVERED'; // Mantener los entregados
            
            if (isValidStatus && note.timestamp_creation) {
                const revenue = Number(note.monto_total || 0);
                const date = new Date(note.timestamp_creation);
                
                // Filtrar por rango de fechas
                if (date >= startDate && date <= endDate) {
                    if (isHourlyAnalysis) {
                        // Agrupar por hora del día
                        const hour = date.getHours();
                        dataStructure[hour].revenue += revenue;
                        dataStructure[hour].orders += 1;
                    } else {
                        // Agrupar por día
                        const dateStr = date.toISOString().slice(0, 10);
                        if (!dataStructure[dateStr]) {
                            dataStructure[dateStr] = { revenue: 0, orders: 0 };
                        }
                        dataStructure[dateStr].revenue += revenue;
                        dataStructure[dateStr].orders += 1;
                    }
                }
            }
        });
    } catch (e) {
        console.warn("Error fetching dp_notes:", e.message);
    }
    
    // Generar labels y datos según el tipo de análisis
    let labels, revenueData, ordersData;
    
    if (isHourlyAnalysis) {
        // Labels para análisis por horas (0-23)
        labels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        revenueData = Array.from({length: 24}, (_, i) => dataStructure[i].revenue);
        ordersData = Array.from({length: 24}, (_, i) => dataStructure[i].orders);
    } else {
        // Labels para análisis por días
        const sortedDates = Object.keys(dataStructure).sort();
        labels = sortedDates;
        revenueData = sortedDates.map(date => dataStructure[date].revenue);
        ordersData = sortedDates.map(date => dataStructure[date].orders);
    }
    
    // Calcular porcentaje de cambio y obtener datos del período anterior
    const calculateChangePercentage = async () => {
        try {
            let previousStart, previousEnd;
            
            if (period === 'day') {
                previousEnd = new Date(startDate);
                previousStart = new Date(startDate);
                previousStart.setDate(previousStart.getDate() - 1);
                previousEnd = previousStart
            } else if (date_from && date_to && date_from === date_to) {
                previousEnd = new Date(startDate);
                previousStart = new Date(startDate);
                previousStart.setDate(previousStart.getDate() - 1);
                previousEnd = previousStart
            } else if (period === 'week') {
                previousEnd = new Date(startDate);
                previousStart = new Date(startDate);
                previousStart.setDate(previousStart.getDate() - 7);
                previousEnd = previousStart
            } else if (period === 'month') {
                previousEnd = new Date(startDate);
                previousStart = new Date(startDate);
                previousStart.setMonth(previousStart.getMonth() - 1);
                previousEnd = previousStart
            } else if (period === 'year') {
                previousEnd = new Date(startDate);
                previousStart = new Date(startDate);
                previousStart.setFullYear(previousStart.getFullYear() - 1);
                previousEnd = previousStart
            } else {
                const currentDuration = endDate.getTime() - startDate.getTime();
                previousEnd = new Date(startDate);
                previousStart = new Date(startDate.getTime() - currentDuration);
                previousEnd = previousStart
            }
            
            const previousStartStr = previousStart.toISOString().slice(0, 10);
            const previousEndStr = previousEnd.toISOString().slice(0, 10);
            
            // Crear estructura para datos anteriores
            let previousDataStructure;
            if (isHourlyAnalysis) {
                previousDataStructure = {};
                for (let i = 0; i < 24; i++) {
                    previousDataStructure[i] = { revenue: 0, orders: 0 };
                }
            } else {
                previousDataStructure = {};
            }
            
            let previousRevenue = 0;
            let previousOrders = 0;
            
            // Obtener datos del período anterior para comandas
            try {
                const previousComandasData = await fetchComandas({ 
                    date_from: previousStartStr, 
                    date_to: previousEndStr
                });
                const previousComandas = Array.isArray(previousComandasData) ? previousComandasData : (previousComandasData?.data || []);
                
                previousComandas.forEach(comanda => {
                    const isValidStatus = comanda.status === 'DELIVERED' || 
                                        comanda.status === 'PENDING' || 
                                        comanda.status === 'CANCELLED' || 
                                        comanda.status === 'CANCELED';
                    
                    if (isValidStatus) {
                        let date;
                        let revenue = Number(comanda.total || 0);
                        
                        if (comanda.status === 'DELIVERED' && comanda.delivered_at) {
                            date = new Date(comanda.delivered_at);
                        } else if ((comanda.status === 'PENDING' || comanda.status === 'CANCELLED' || comanda.status === 'CANCELED') && comanda.sent_at) {
                            date = new Date(comanda.sent_at);
                        }
                        
                        if (date && date >= previousStart && date <= previousEnd) {
                            previousRevenue += revenue;
                            previousOrders += 1;
                            
                            if (isHourlyAnalysis===false) {
                                const dateStr = date.toISOString().slice(0, 10);
                                if (!previousDataStructure[dateStr]) {
                                    previousDataStructure[dateStr] = { revenue: 0, orders: 0 };
                                }
                                previousDataStructure[dateStr].revenue += revenue;
                                previousDataStructure[dateStr].orders += 1;
                            }
                        }
                        if (date && isHourlyAnalysis) {
                            previousRevenue += revenue;
                            previousOrders += 1;

                            const hour = date.getHours();
                            previousDataStructure[hour].revenue += revenue;
                            previousDataStructure[hour].orders += 1;
                        }
                    }
                });
            } catch (e) {
                console.warn("Error fetching previous comandas:", e.message);
            }
                
                // Obtener datos del período anterior para delivery/pickup
            try {
                const previousDpNotesData = await fetchDpNotes({ 
                    date_from: previousStartStr, 
                    date_to: previousEndStr 
                });
                const previousDpNotes = Array.isArray(previousDpNotesData) ? previousDpNotesData : (previousDpNotesData?.data || []);
                
                previousDpNotes.forEach(note => {
                    const isValidStatus = note.current_status === 'EN_ROUTE' || 
                                        note.current_status === 'PENDING_REVIEW' || 
                                        note.current_status === 'IN_KITCHEN' || 
                                        note.current_status === 'CANCELLED' || 
                                        note.current_status === 'CANCELED' ||
                                        note.current_status === 'DELIVERED';
                    
                    if (isValidStatus && note.timestamp_creation) {
                        const revenue = Number(note.monto_total || 0);
                        const date = new Date(note.timestamp_creation);

                        if (date >= previousStart && date <= previousEnd) {
                            previousRevenue += revenue;
                            previousOrders += 1;
                            
                            if (isHourlyAnalysis===false) {
                                const dateStr = date.toISOString().slice(0, 10);
                                if (!previousDataStructure[dateStr]) {
                                    previousDataStructure[dateStr] = { revenue: 0, orders: 0 };
                                }
                                previousDataStructure[dateStr].revenue += revenue;
                                previousDataStructure[dateStr].orders += 1;
                            }
                        }
                        else if (isHourlyAnalysis) {
                            previousRevenue += revenue;
                            previousOrders += 1;

                            const hour = date.getHours();
                            previousDataStructure[hour].revenue += revenue;
                            previousDataStructure[hour].orders += 1;
                        }
                    }
                });
            } catch (e) {
                console.warn("Error fetching previous dp_notes:", e.message);
            }
            
            // Generar arrays de datos para el período anterior
            let previousLabels, previousRevenueData, previousOrdersData;

            if (isHourlyAnalysis) {
                previousLabels = Array.from({length: 24}, (_, i) => `${i.toString().padStart(2, '0')}:00`);
                previousRevenueData = Array.from({length: 24}, (_, i) => previousDataStructure[i].revenue);
                previousOrdersData = Array.from({length: 24}, (_, i) => previousDataStructure[i].orders);
            } else {
                const sortedDates = Object.keys(previousDataStructure).sort();
                previousLabels = sortedDates;
                previousRevenueData = sortedDates.map(date => previousDataStructure[date].revenue);
                previousOrdersData = sortedDates.map(date => previousDataStructure[date].orders);
            }
            
            // Calcular porcentajes de cambio
            const currentRevenue = revenueData.reduce((a, b) => a + b, 0);
            const currentOrders = ordersData.reduce((a, b) => a + b, 0);
            
            const revenueChange = previousRevenue > 0 ? 
                ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
            const ordersChange = previousOrders > 0 ? 
                ((currentOrders - previousOrders) / previousOrders) * 100 : 0;
            
            return {
                revenue: {
                    current: currentRevenue,
                    previous: previousRevenue,
                    change_percentage: parseFloat(revenueChange.toFixed(1)),
                    trend_direction: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'flat'
                },
                orders: {
                    current: currentOrders,
                    previous: previousOrders,
                    change_percentage: parseFloat(ordersChange.toFixed(1)),
                    trend_direction: ordersChange > 0 ? 'up' : ordersChange < 0 ? 'down' : 'flat'
                },
                chartData: {
                    labels: previousLabels,
                    revenueData: previousRevenueData,
                    ordersData: previousOrdersData
                }
            };
        } catch (e) {
            console.warn("Error calculating change percentage:", e.message);
            return {
                revenue: { change_percentage: 0, trend_direction: 'flat' },
                orders: { change_percentage: 0, trend_direction: 'flat' },
                chartData: {
                    labels: [],
                    revenueData: [],
                    ordersData: []
                }
            };
        }
    };
    
    const changeData = await calculateChangePercentage();
    
    return {
        success: true,
        timestamp: new Date().toISOString(),
        period: {
            start: startDateStr,
            end: endDateStr,
            type: period || 'custom',
            analysis_type: isHourlyAnalysis ? 'hourly' : 'daily'
        },
        data: {
            labels,
            datasets: [
                {
                    label: "Ganancias Actuales",
                    data: revenueData,
                    borderColor: "rgb(75, 192, 192)",
                    backgroundColor: "rgba(75, 192, 192, 0.2)",
                    tension: 0.1,
                    fill: true
                },
                {
                    label: "Ganancias Anteriores",
                    data: changeData.chartData.revenueData,
                    borderColor: "rgb(54, 162, 235)",
                    backgroundColor: "rgba(54, 162, 235, 0.2)",
                    tension: 0.1,
                    fill: true,
                    borderDash: [5, 5]
                },
                {
                    label: "Órdenes Actuales",
                    data: ordersData,
                    borderColor: "rgb(255, 99, 132)",
                    backgroundColor: "rgba(255, 99, 132, 0.2)",
                    tension: 0.1,
                    fill: true,
                    yAxisID: 'y1'
                },
                {
                    label: "Órdenes Anteriores",
                    data: changeData.chartData.ordersData,
                    borderColor: "rgb(255, 159, 64)",
                    backgroundColor: "rgba(255, 159, 64, 0.2)",
                    tension: 0.1,
                    fill: true,
                    yAxisID: 'y1',
                    borderDash: [5, 5]
                }
            ],
            summary: {
                totalRevenue: revenueData.reduce((a, b) => a + b, 0),
                totalOrders: ordersData.reduce((a, b) => a + b, 0),
                averageRevenue: revenueData.length > 0 ? 
                    revenueData.reduce((a, b) => a + b, 0) / revenueData.length : 0,
                averageOrders: ordersData.length > 0 ? 
                    ordersData.reduce((a, b) => a + b, 0) / ordersData.length : 0,
                change_percentage: {
                    revenue: changeData.revenue.change_percentage,
                    orders: changeData.orders.change_percentage
                },
                trend_direction: {
                    revenue: changeData.revenue.trend_direction,
                    orders: changeData.orders.trend_direction
                },
                comparison: {
                    revenue: {
                        current: changeData.revenue.current,
                        previous: changeData.revenue.previous
                    },
                    orders: {
                        current: changeData.orders.current,
                        previous: changeData.orders.previous
                    }
                }
            }
        }
    };
};
