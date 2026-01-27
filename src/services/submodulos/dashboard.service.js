import { prisma } from '../../db/client.js';
import { isSameUtcDate, minutesBetween } from "../../utils/timeHelpers.js";
import { 
    fetchComandas, 
    fetchDpNotes, 
    fetchClienteTemporal,
    fetchMesas 
} from '../consumers/externalConsumers.js';

export const getSummary = async (filters) => {
    const { date, force_refresh, store_id } = filters;
    const targetDate = date ? new Date(date) : new Date();
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    let totalRevenue = 0;
    let totalOrders = 0;

    // 1. Fetch Atencion Cliente (Sala)
    try {
        const atClientBaseUrl = process.env.AT_CLIENT_BASE_URL || envs.AT_CLIENT_BASE_URL || 'https://charlotte-atencion-cliente.onrender.com/api/v1/atencion-cliente';
        const atClientUrl = `${atClientBaseUrl}/comandas`; 
        console.log("Fetching Sala:", atClientUrl);
        const resAt = await fetch(atClientUrl);
        if (resAt.ok) {
            const jsonAt = await resAt.json();
            const dataAt = Array.isArray(jsonAt) ? jsonAt : (jsonAt.data || []);
            // Filtrar por fecha localmente si el API no filtra
            const filtered = dataAt.filter(c => (c.created_at || c.createdAt || '').startsWith(targetDateStr));
            filtered.forEach(c => {
                 totalRevenue += Number(c.total || 0);
                 totalOrders++;
            });
        }
    } catch (e) { console.warn("Error Sala API:", e.message); }

    // 2. Fetch dp_notes de Delivery/Pickup (excluyendo CANCELLED)
    try {
        const deliveryBaseUrl = process.env.DELIVERY_BASE_URL || envs.DELIVERY_BASE_URL || 'https://delivery-pickup.onrender.com/api/dp/v1';
        const delUrl = `${deliveryBaseUrl}/orders?date=${targetDateStr}`;
        console.log("Fetching Delivery:", delUrl);
        const resDel = await fetch(delUrl);
        if (resDel.ok) {
            const dataDel = await resDel.json();
            const orders = Array.isArray(dataDel) ? dataDel : (dataDel.data || []);
            orders.forEach(o => {
                if (o.current_status !== 'CANCELLED' && o.status !== 'CANCELLED') {
                    totalRevenue += Number(o.monto_total || o.total || 0);
                    totalOrders++;
                }
            });
        }
    } catch (e) { console.warn("Error Delivery API:", e.message); }

    // 5. Meta y Proyección Trimestral
    const meta = await prisma.kpiMeta.findFirst({
        where: { activa: true, fechaInicio: { lte: targetDate }, fechaFin: { gte: targetDate } }
    });
    const target = Number(meta?.montoObjetivo || 450000);
    // Para quarterly goal, necesitaríamos acumular desde inicio del trimestre
    // Por ahora usamos solo el día actual como placeholder
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

    return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
            revenue: {
                total: totalRevenue,
                currency: "USD",
                trend_percentage: 0, // TODO: Calcular comparando con día anterior
                trend_direction: "flat"
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
    const { date_from, date_to, granularity } = filters;
    const start = new Date(date_from);
    const end = new Date(date_to);

    const snapshots = await prisma.kpiSnapshotDiario.findMany({
        where: {
            fechaCorte: { gte: start, lte: end }
        },
        orderBy: { fechaCorte: 'asc' }
    });

    // Mapear a formato gráfico
    // Ejemplo: labels, datasets...
    const labels = snapshots.map(s => s.fechaCorte.toISOString().slice(0,10));
    const dataVentas = snapshots.map(s => Number(s.totalVentas));

    return { 
        success: true, 
        data: {
            labels,
            datasets: [
                { label: "Ventas", data: dataVentas }
            ]
        } 
    };
};
