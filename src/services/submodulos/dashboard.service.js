import fetch from 'node-fetch'; // Asegurar fetch
import { prisma } from '../../db/client.js';
import { envs } from '../../config/envs.js';
import { isSameUtcDate } from "../../utils/timeHelpers.js";

export const getSummary = async (filters) => {
    const { date, force_refresh, store_id } = filters;
    const targetDate = date ? new Date(date) : new Date();
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    let totalRevenue = 0;
    let totalOrders = 0;

    // 1. Fetch Atencion Cliente (Sala)
    try {
        const atClientUrl = `${process.env.AT_CLIENT_BASE_URL || envs.AT_CLIENT_BASE_URL}/comandas`; 
        // Nota: Docs no especifican filtro de fecha en query param estándar, pero inyectamos ?date= por convención REST
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

    // 2. Fetch Delivery
    try {
        const delUrl = `${process.env.DELIVERY_BASE_URL || envs.DELIVERY_BASE_URL}/orders?date=${targetDateStr}`;
        console.log("Fetching Delivery:", delUrl);
        const resDel = await fetch(delUrl);
        if (resDel.ok) {
            const dataDel = await resDel.json();
            const orders = Array.isArray(dataDel) ? dataDel : [];
            orders.forEach(o => {
                if (o.current_status !== 'CANCELLED') {
                    totalRevenue += Number(o.monto_total || 0);
                    totalOrders++;
                }
            });
        }
    } catch (e) { console.warn("Error Delivery API:", e.message); }

    // 3. Meta y Proyección
    const meta = await prisma.kpiMeta.findFirst({
        where: { activa: true, fechaInicio: { lte: targetDate }, fechaFin: { gte: targetDate } }
    });
    const target = Number(meta?.montoObjetivo || 450000);
    const acumulado = totalRevenue * 1 // Solo hoy por ahora
    const progressPct = target > 0 ? (acumulado / target) * 100 : 0;

    return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
            revenue: {
                total: totalRevenue,
                currency: "USD",
                trend_percentage: 0,
                trend_direction: "flat"
            },
            quarterly_goal: {
                target,
                current: acumulado,
                progress_percentage: parseFloat(progressPct.toFixed(1)),
                ui_status: progressPct > 80 ? "ON_TRACK" : "OFF_TRACK"
            },
            operations: {
                avg_service_time: "15 min", // Placeholder hasta conectar KDS History
                time_status: "WARNING",
                table_rotation: 1.2,
                rotation_status: "OPTIMAL"
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
