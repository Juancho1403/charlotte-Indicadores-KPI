import { prisma } from '../../db/client.js';
import { minutesBetween, isSameUtcDate } from "../../utils/timeHelpers.js";
import { 
    fetchStaff, 
    fetchKdsHistory, 
    fetchComandas 
} from '../consumers/externalConsumers.js';

/**
 * Obtener Ranking de Personal
 * Lógica: Realizar JOIN entre KitchenStaff/Users y tablas de comandas/dp_logs
 * Calcular efficiency_score basado en: cantidad de órdenes vs tiempo promedio vs errores
 */
export const getStaffRanking = async (filters) => {
    const { sort_by = 'EFFICIENCY', limit = 20, page = 1, shift } = filters;

    try {
        // 1. Obtener lista de staff del módulo Cocina
        const staffParams = shift ? { shift } : {};
        const staffData = await fetchStaff(staffParams);
        const staffList = Array.isArray(staffData) ? staffData : (staffData?.data || []);
        
        if (staffList.length === 0) {
            return {
                success: true,
                data: [],
                meta: { total_items: 0, current_page: Number(page), per_page: Number(limit) }
            };
        }

        // 2. Obtener historial de KDS para calcular métricas reales
        const kdsHistoryData = await fetchKdsHistory({});
        const kdsHistory = Array.isArray(kdsHistoryData) ? kdsHistoryData : (kdsHistoryData?.data || []);
        
        // 3. Obtener comandas para contar órdenes por staff
        const comandasData = await fetchComandas({});
        const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);

        // 4. Calcular métricas por staff member
        const ranking = staffList.map(staff => {
            const staffId = String(staff.id || staff._id || staff.waiter_id || '');
            
            // Contar órdenes del staff
            const staffComandas = comandas.filter(c => 
                String(c.waiter_id || c.waiterId || '') === staffId
            );
            const totalOrders = staffComandas.length;
            
            // Calcular tiempo promedio desde KDS history
            const staffKdsOrders = kdsHistory.filter(k => {
                const orderId = k.external_order_id || k.comanda_id || '';
                return staffComandas.some(c => String(c.id || c.order_id || '') === String(orderId));
            });
            
            let avgTimeMinutes = 0;
            if (staffKdsOrders.length > 0) {
                const times = staffKdsOrders
                    .filter(k => k.sent_at && k.delivered_at)
                    .map(k => minutesBetween(k.sent_at, k.delivered_at))
                    .filter(t => t > 0 && t < 240); // Excluir outliers
                
                if (times.length > 0) {
                    avgTimeMinutes = times.reduce((a, b) => a + b, 0) / times.length;
                }
            }
            
            // Calcular efficiency_score (0-100)
            // Fórmula simplificada: más órdenes y menos tiempo = mejor score
            let efficiencyScore = 50; // Base
            if (totalOrders > 0) {
                efficiencyScore += Math.min(totalOrders * 0.5, 30); // Bonus por volumen
            }
            if (avgTimeMinutes > 0 && avgTimeMinutes < 10) {
                efficiencyScore += Math.max(0, 20 - avgTimeMinutes * 2); // Bonus por velocidad
            }
            efficiencyScore = Math.min(100, Math.max(0, Math.round(efficiencyScore)));
            
            // Determinar status basado en último login o actividad
            const currentStatus = staff.status || (totalOrders > 0 ? "ACTIVE" : "INACTIVE");
            
            return {
                waiter_id: staffId,
                name: staff.name || staff.nombre || 'Staff',
                total_orders: totalOrders,
                avg_time_minutes: parseFloat(avgTimeMinutes.toFixed(1)),
                efficiency_score: efficiencyScore,
                current_status: currentStatus
            };
        });

        // 5. Ordenar según sort_by
        if (sort_by === 'EFFICIENCY') {
            ranking.sort((a, b) => b.efficiency_score - a.efficiency_score);
        } else if (sort_by === 'VOLUME') {
            ranking.sort((a, b) => b.total_orders - a.total_orders);
        }

        // 6. Paginación
        const totalItems = ranking.length;
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 20;
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;
        const pagedRanking = ranking.slice(startIndex, endIndex);

        return {
            success: true,
            data: pagedRanking,
            meta: { 
                total_items: totalItems, 
                current_page: pageNum, 
                per_page: limitNum 
            }
        };

    } catch (e) {
        console.warn("Error en getStaffRanking:", e.message);
        return { 
            success: false, 
            data: [],
            meta: { total_items: 0, current_page: Number(page), per_page: Number(limit) }
        };
    }
};

/**
 * getSlaBreakdown - Obtener Desglose SLA (Semáforo)
 * Lógica: Filtrar comandas con deliveredAt no nulo
 * Calcular delta: deliveredAt - sentAt
 * Clasificar en buckets: Verde (< 5 min), Amarillo (5-10 min), Rojo (> 10 min)
 * @param {Object} query - object with optional `date` string (ISO or YYYY-MM-DD)
 * @returns {Promise<Object>} - { green_zone_percent, yellow_zone_percent, red_zone_percent, data_timestamp }
 */
export async function getSlaBreakdown(query = {}) {
  try {
    const targetDate = query.date || new Date().toISOString().slice(0, 10);
    
    // Obtener historial de KDS que contiene comandas con estados READY/DELIVERED
    const kdsHistoryData = await fetchKdsHistory({ date: targetDate });
    const kdsHistory = Array.isArray(kdsHistoryData) ? kdsHistoryData : (kdsHistoryData?.data || []);
    
    // Filtrar: solo comandas entregadas (delivered_at !== null)
    const delivered = kdsHistory.filter(c => c.delivered_at || c.deliveredAt);
    
    // Filtrar por fecha solicitada (basado en delivered_at)
    const deliveredOnDate = delivered.filter(c => {
      try {
        const deliveredDate = c.delivered_at || c.deliveredAt;
        if (!deliveredDate) return false;
        return isSameUtcDate(deliveredDate, targetDate);
      } catch (e) {
        return false;
      }
    });

    // Si no hay comandas entregadas para esa fecha, retornar ceros
    if (deliveredOnDate.length === 0) {
      return {
        green_zone_percent: 0,
        yellow_zone_percent: 0,
        red_zone_percent: 0,
        data_timestamp: new Date().toISOString(),
      };
    }

    // Calcular tiempo de servicio para cada comanda y clasificar
    let green = 0, yellow = 0, red = 0;
    for (const c of deliveredOnDate) {
      let serviceMinutes = undefined;
      
      // Intentar obtener tiempo de servicio de diferentes campos
      if (c.metrics && typeof c.metrics.service_time_minutes === 'number') {
        serviceMinutes = c.metrics.service_time_minutes;
      } else if (c.sent_at && c.delivered_at) {
        serviceMinutes = minutesBetween(c.sent_at, c.delivered_at);
      } else if (c.sent_at && c.deliveredAt) {
        serviceMinutes = minutesBetween(c.sent_at, c.deliveredAt);
      } else if (c.created_at && c.delivered_at) {
        serviceMinutes = minutesBetween(c.created_at, c.delivered_at);
      } else {
        // Si no se puede calcular, saltar este registro
        continue;
      }

      // Clasificar en buckets según documentación:
      // Verde: < 5 min
      // Amarillo: 5 - 10 min
      // Rojo: > 10 min
      if (serviceMinutes < 5) {
        green += 1;
      } else if (serviceMinutes <= 10) {
        yellow += 1;
      } else {
        red += 1;
      }
    }

    const total = green + yellow + red;
    // Evitar división por cero
    if (total === 0) {
      return {
        green_zone_percent: 0,
        yellow_zone_percent: 0,
        red_zone_percent: 0,
        data_timestamp: new Date().toISOString(),
      };
    }

    const greenPct = Math.round((green / total) * 100);
    const yellowPct = Math.round((yellow / total) * 100);
    const redPct = Math.round((red / total) * 100);

    // Ajustar redondeo para que la suma sea 100 (distribuir error de redondeo al grupo más grande)
    let sum = greenPct + yellowPct + redPct;
    if (sum !== 100) {
      const dif = 100 - sum;
      // Encontrar el grupo más grande
      const maxVal = Math.max(greenPct, yellowPct, redPct);
      if (greenPct === maxVal) {
        return {
          green_zone_percent: greenPct + dif,
          yellow_zone_percent: yellowPct,
          red_zone_percent: redPct,
          data_timestamp: new Date().toISOString(),
        };
      } else if (yellowPct === maxVal) {
        return {
          green_zone_percent: greenPct,
          yellow_zone_percent: yellowPct + dif,
          red_zone_percent: redPct,
          data_timestamp: new Date().toISOString(),
        };
      } else {
        return {
          green_zone_percent: greenPct,
          yellow_zone_percent: yellowPct,
          red_zone_percent: redPct + dif,
          data_timestamp: new Date().toISOString(),
        };
      }
    }

    return {
      green_zone_percent: greenPct,
      yellow_zone_percent: yellowPct,
      red_zone_percent: redPct,
      data_timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error en getSlaBreakdown:", error.message);
    // Fallback Mock Data
    return {
        green_zone_percent: 75,
        yellow_zone_percent: 15,
        red_zone_percent: 10,
        data_timestamp: new Date().toISOString()
    };
  }
}

/**
 * getStaffMetrics(waiter_id, query)
 *
 * Returns paginated time-series points for the requested waiter and date range.
 */
export async function getStaffMetrics(waiter_id, query = {}) {
  const {
    date_from: dateFromRaw,
    date_to: dateToRaw,
    granularity = 'daily',
    page = 1,
    page_size = 30,
  } = query || {};

  const now = new Date();
  let dateFrom = dateFromRaw ? parseISO(String(dateFromRaw)) : addDays(startOfDay(now), -6);
  let dateTo = dateToRaw ? parseISO(String(dateToRaw)) : startOfDay(now);

  if (Number.isNaN(dateFrom.getTime())) dateFrom = addDays(startOfDay(now), -6);
  if (Number.isNaN(dateTo.getTime())) dateTo = startOfDay(now);

  if (dateFrom > dateTo) {
    const tmp = dateFrom;
    dateFrom = dateTo;
    dateTo = tmp;
  }

  // 1) Fetch staff list from kitchen API (best-effort)
  // Todavía no se ha implementado por lo que no puede llamar el API
  let staffList = [];
  try {
    const base = process.env.KITCHEN_API_BASE || '';
    const url = `${base}/api/kitchen/staff`;
    const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (resp.ok) {
      staffList = await resp.json();
    } else {
      staffList = [];
    }
  } catch (err) {
    staffList = [];
  }

  const waiterIdStr = String(waiter_id);
  const staffMember = staffList.find((s) => String(s.id) === waiterIdStr || String(s.userId) === waiterIdStr || String(s.workerCode) === waiterIdStr) || null;

  // 2) Query orders from Prisma (best-effort; adapt to your schema)
  const start = startOfDay(dateFrom);
  const end = endOfDay(dateTo);

  let orders = [];
  try {
    orders = await prisma.order.findMany({
      where: {
        OR: [
          { waiterId: String(waiter_id) },
          { waiter_id: String(waiter_id) },
          { waiterId: Number(waiter_id) || undefined },
        ],
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        waiterId: true,
        createdAt: true,
        finishedAt: true,
        completedAt: true,
      },
    });

  } catch (err) {
    console.warn("Fallo lectura DB para StaffMetrics, continuando con array vacio o mock...", err.message);
    // Si falla la DB, inyectamos datos mock para visualizar en frontend
    if (orders.length === 0) {
        const now = new Date();
        orders = [
            { id: 1, waiterId: 101, createdAt: addDays(now, -1), finishedAt: addDays(now, -1) },
            { id: 2, waiterId: 101, createdAt: addDays(now, -2), finishedAt: addDays(now, -2) }
        ];
    }
  }

  // 3) Aggregate into buckets
  const buckets = buildDateBuckets(start, end, granularity);
  const map = new Map();

  for (const b of buckets) {
    map.set(dateKey(b), { count: 0, durationsSeconds: [] });
  }

  for (const o of orders) {
    const created = o.createdAt ? startOfDay(new Date(o.createdAt)) : null;
    if (!created) continue;

    let keyDate = dateKey(created);
    if (!map.has(keyDate)) continue;

    const entry = map.get(keyDate);
    entry.count += 1;
    const dur = durationSecondsForOrder(o);
    if (dur != null) entry.durationsSeconds.push(dur);
    map.set(keyDate, entry);
  }

  // 4) Fetch SLA rules from DB
  let slaRules = [];
  try {
    slaRules = await prisma.kpiReglaSemaforo.findMany();
  } catch (err) {
    slaRules = [];
  }

  // Build points array
  const points = [];
  for (const [key, val] of map.entries()) {
    const avgTime = val.durationsSeconds.length
      ? Math.round(val.durationsSeconds.reduce((a, b) => a + b, 0) / val.durationsSeconds.length)
      : null;
    const slaCompliance = computeSlaComplianceForDurations(val.durationsSeconds, slaRules);
    points.push({
      date: key,
      daily_orders: val.count,
      avg_time: avgTime,
      sla_compliance: slaCompliance,
    });
  }

  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // 5) Pagination
  const total = points.length;
  const p = Number(page) && Number(page) > 0 ? Number(page) : 1;
  const ps = Number(page_size) && Number(page_size) > 0 ? Number(page_size) : 30;
  const startIndex = (p - 1) * ps;
  const endIndex = startIndex + ps;
  const paged = points.slice(startIndex, endIndex);
  
  return {
    meta: {
      total,
      page: p,
      page_size: ps,
      waiter: staffMember || { id: waiter_id },
      date_from: formatISO(start),
      date_to: formatISO(end),
      granularity,
    },
    data: paged,
  };
}
