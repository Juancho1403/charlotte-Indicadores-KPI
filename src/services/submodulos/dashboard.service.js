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

    // 1. Fetch Comandas cerradas de Atención al Cliente (Sala)
    // Según docs: Revenue = Sumar monto_total de dp_notes (Delivery) y comandas cerradas
    try {
        console.log("Fetching Comandas from ATC for date:", targetDateStr);
        const comandasData = await fetchComandas({ date: targetDateStr, status: 'CLOSED' });
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
        
        // Filtrar por fecha localmente si el API no filtra
        const filtered = comandas.filter(c => {
            const createdDate = c.created_at || c.createdAt || c.timestamp_creation || '';
            return createdDate.toString().startsWith(targetDateStr);
        });
        
        filtered.forEach(c => {
            // Excluir comandas canceladas según lógica de negocio
            if (c.status !== 'CANCELLED' && c.status !== 'CANCELED') {
                totalRevenue += Number(c.total || c.monto_total || 0);
                totalOrders++;
            }
        });
    } catch (e) { 
        console.warn("Error fetching Comandas from ATC:", e.message); 
    }

    // 2. Fetch dp_notes de Delivery/Pickup (excluyendo CANCELLED)
    try {
        console.log("Fetching dp_notes from Delivery for date:", targetDateStr);
        const dpNotesData = await fetchDpNotes({ date: targetDateStr });
        const dpNotes = Array.isArray(dpNotesData) ? dpNotesData : (dpNotesData?.data || []);
        
        dpNotes.forEach(note => {
            // Filtrar por fecha y excluir canceladas
            const noteDate = note.created_at || note.timestamp_creation || '';
            if (noteDate.toString().startsWith(targetDateStr) && 
                note.status !== 'CANCELLED' && 
                note.status !== 'CANCELED') {
                totalRevenue += Number(note.monto_total || note.total_amount || 0);
                totalOrders++;
            }
        });
    } catch (e) { 
        console.warn("Error fetching dp_notes from Delivery:", e.message); 
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
    const start = new Date(date_from) || new Date();
    const end = new Date(date_to) || new Date();

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
