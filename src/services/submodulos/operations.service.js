import fetch from 'node-fetch';
import { prisma } from '../../db/client.js';
import { envs } from '../../config/envs.js';
import { minutesBetween, isSameUtcDate } from "../../utils/timeHelpers.js"

const COMANDAS_API_URL = process.env.COMANDAS_API_URL || 'http://localhost:3000/comandas';

export const getStaffRanking = async (filters) => {
    const { sort_by = 'EFFICIENCY', limit = 20, page = 1 } = filters;

    try {
        const kitchBaseUrl = process.env.KITCHEN_BASE_URL || envs.KITCHEN_BASE_URL || 'https://charlotte-cocina.onrender.com/api';
        const kdsUrl = `${kitchBaseUrl}/staff`;
        // Consumir API de Personal
        console.log("Fetching Kitchen Staff:", kdsUrl);
        const res = await fetch(kdsUrl);
        if (!res.ok) throw new Error(`Staff API error: ${res.status}`);
        
        const json = await res.json();
        const staffList = Array.isArray(json) ? json : (json.data || []);
        // Mapear a formato ranking
        // En un mundo ideal cruzamos con /kds/history para sacar métricas reales.
        // Por ahora asignamos métricas placeholder sobre los usuarios reales encontrados.
        const ranking = staffList.map(s => ({
             waiter_id: s.id || s._id || s.workerCode,
             name: s.name || s.nombre || 'Personal de Cocina',
             role: s.role || 'Staff',
             total_orders: Math.floor(Math.random() * 50) + 10, // Placeholder hasta cruzar con /kds/history
             avg_time_minutes: Math.floor(Math.random() * 15) + 5, // Placeholder
             efficiency_score: 85,
             current_status: (s.status || 'ACTIVE').toUpperCase()
        }));

        return {
            success: true,
            data: ranking.slice(0, Number(limit)),
            meta: { total_items: ranking.length }
        };

    } catch (e) {
        console.warn("KDS Staff Error:", e.message);
        return { success: false, data: [] };
    }
};

/**
 * getSlaBreakdown
 * @param {Object} query - object with optional `date` string (ISO or YYYY-MM-DD)
 * @returns {Promise<Object>} - { green_zone_percent, yellow_zone_percent, red_zone_percent, data_timestamp }
 */
export async function getSlaBreakdown(query = {}) {
  try {
    const url = new URL(COMANDAS_API_URL);
    // If the comandas endpoint supports a date query param, you can pass it.
    // We still perform filtering locally to be robust.
    if (query.date) url.searchParams.set('date', query.date);

    const resp = await fetch(url.toString(), { method: 'GET' });
    if (!resp.ok) {
      throw new Error(`Failed to fetch comandas: ${resp.status} ${resp.statusText}`);
    }
    const payload = await resp.json();

    // Expect payload.data to be an array
    const comandas = Array.isArray(payload?.data) ? payload.data : [];

    // Filter: only delivered comandas (delivered_at !== null)
    const delivered = comandas.filter(c => c.delivered_at);

    // Further filter by requested date (based on delivered_at)
    const targetDate = query.date; 
    const deliveredOnDate = delivered.filter(c => {
      try {
        return isSameUtcDate(c.delivered_at, targetDate);
      } catch (e) {
        return false;
      }
    });

    // If there are no delivered comandas for that date, return zeros with timestamp
    if (deliveredOnDate.length === 0) {
      return {
        green_zone_percent: 0,
        yellow_zone_percent: 0,
        red_zone_percent: 0,
        data_timestamp: new Date().toISOString(),
      };
    }

    // Compute service_time_minutes for each and classify
    let green = 0, yellow = 0, red = 0;
    for (const c of deliveredOnDate) {
      let serviceMinutes = undefined;
      if (c.metrics && typeof c.metrics.service_time_minutes === 'number') {
        serviceMinutes = c.metrics.service_time_minutes;
      } else if (c.sent_at && c.delivered_at) {
        serviceMinutes = minutesBetween(c.sent_at, c.delivered_at);
      } else {
        // If cannot compute, skip this record
        continue;
      }

      if (serviceMinutes < 5) {
        green += 1;
      } else if (serviceMinutes <= 10) {
        yellow += 1;
      } else {
        red += 1;
      }
    }

    const total = green + yellow + red;
    // Avoid division by zero
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

    // Adjust rounding so sum is 100 (distribute rounding error to largest group)
    let sum = greenPct + yellowPct + redPct;
    if (sum !== 100) {
      const dif = 100 - sum;
      // find max group
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
    console.error("Error en SlaBreakdown (Usando Mock):", error.message);
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
