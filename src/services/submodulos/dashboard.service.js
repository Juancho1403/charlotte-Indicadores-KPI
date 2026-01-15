import { prisma } from '../../db/client.js';
import { isSameUtcDate } from "../../utils/timeHelpers.js";

export const getSummary = async (filters) => {
    const { date, force_refresh, store_id } = filters;
    const targetDate = date ? new Date(date) : new Date();
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    // 1. Obtener Meta Activa
    const meta = await prisma.kpiMeta.findFirst({
        where: {
            activa: true,
            fechaInicio: { lte: targetDate },
            fechaFin: { gte: targetDate }
        }
    });

    // 2. Obtener Snapshot del día (o calcular si es 'hoy' y no existe/force_refresh)
    let snapshot = await prisma.kpiSnapshotDiario.findUnique({
        where: { fechaCorte: new Date(targetDateStr) }
    });

    // Lógica Simple: Si es hoy y no hay snapshot (o force=true), calculamos "al vuelo" (Mock o Real)
    // En un escenario real, esto haría SUM(orders) WHERE date = today.
    // Aquí, si no hay snapshot, asumimos 0 o usamos lo que haya en la tabla 'Order' si existe.
    if (!snapshot && isSameUtcDate(new Date().toISOString(), targetDateStr)) {
         // Intentar calcular desde Order/DpNote si existen datos
         const startOfDay = new Date(targetDateStr);
         const endOfDay = new Date(targetDateStr);
         endOfDay.setHours(23, 59, 59, 999);

         try {
             // Agregación tentativa (si las tablas Order existen y tienen datos)
             const totalOrders = await prisma.order.aggregate({
                 _sum: { total: true },
                 _count: { id: true },
                 where: {
                     createdAt: { gte: startOfDay, lte: endOfDay },
                     status: { not: 'CANCELLED' } // Asumiendo estado
                 }
             });
             
             // Si no hay ordenes, valores en 0
             snapshot = {
                totalVentas: totalOrders._sum.total || 0,
                totalPedidos: totalOrders._count.id || 0,
                tiempoPromedioMin: 0, 
                rotacionMesasIndice: 0,
                alertasGeneradas: 0,
             };
         } catch (e) {
             console.warn("No se pudo calcular desde Order:", e.message);
             snapshot = { totalVentas: 0, totalPedidos: 0, tiempoPromedioMin: 0, rotacionMesasIndice: 0, alertasGeneradas: 0 };
         }
    } else if (!snapshot) {
        // Dia pasado sin datos
        snapshot = { totalVentas: 0, totalPedidos: 0, tiempoPromedioMin: 0, rotacionMesasIndice: 0, alertasGeneradas: 0 };
    }

    // 3. Cálculos de UI
    const revenue = Number(snapshot.totalVentas || 0);
    const target = Number(meta?.montoObjetivo || 450000); // Default fallback
    
    // Progreso trimestral (acumulado real seria SUM(snapshots) en el rango de la meta)
    // Para simplificar este endpoint "diario", mostramos el progreso GLOBAL de la meta si podemos,
    // o el progreso del día. El requisito dice "Quarterly Goal ... Progreso = acumulado / objetivo".
    // Calculamos el acumulado hasta hoy.
    let acumulado = 0;
    if (meta) {
        const aggr = await prisma.kpiSnapshotDiario.aggregate({
            _sum: { totalVentas: true },
            where: {
                fechaCorte: { gte: meta.fechaInicio, lte: targetDate } // Hasta fecha consultada
            }
        });
        acumulado = Number(aggr._sum.totalVentas || 0);
        // Sumar lo de hoy si no se ha guardado en DB aun (snapshot calculado al vuelo)
        if (!snapshot.idLog) { // Si es un objeto temporal
            acumulado += revenue;
        }
    } else {
        acumulado = revenue; // Fallback
    }

    const progressPct = target > 0 ? (acumulado / target) * 100 : 0;
    
    // Status UI
    let uiStatus = "OFF_TRACK";
    // Regla de negocio simple: Si progress < (dias_pasados / dias_total), Warning.
    // O usar thresholds fijos. Usaremos un umbral simple del 80% esperado pro-rata.
    // ... Implementación simplificada
    if (progressPct >= 80) uiStatus = "ON_TRACK"; // Dummy logic

    return {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
            revenue: {
                total: revenue,
                currency: "USD",
                trend_percentage: 12.5, // Dummy o calcular vs semana pasada
                trend_direction: "UP"
            },
            quarterly_goal: {
                target: target,
                current: acumulado,
                progress_percentage: parseFloat(progressPct.toFixed(1)),
                ui_status: uiStatus
            },
            operations: {
                avg_service_time: snapshot.tiempoPromedioMin ? `${snapshot.tiempoPromedioMin} min` : "0 min",
                time_status: snapshot.tiempoPromedioMin > 10 ? "CRITICAL" : (snapshot.tiempoPromedioMin > 5 ? "WARNING" : "OPTIMAL"),
                table_rotation: Number(snapshot.rotacionMesasIndice || 0),
                rotation_status: Number(snapshot.rotacionMesasIndice) < 1.2 ? "WARNING" : "OPTIMAL"
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
