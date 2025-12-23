import { prisma } from '../../db/client.js';
import { minutesBetween, isSameUtcDate } from "../../utils/timeHelpers.js"

const COMANDAS_API_URL = process.env.COMANDAS_API_URL || 'http://localhost:3000/comandas';

export const getStaffRanking = async (filters) => {
    // TODO: Implementar lógica de ranking de personal
    return { success: true, data: [], meta: {} };
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
    // Bubble up error to controller which will return 500
    throw error;
  }
}

export const getStaffMetrics = async (waiterId, filters) => {
    // TODO: Implementar métricas individuales
    return { success: true, data: [] };
};
