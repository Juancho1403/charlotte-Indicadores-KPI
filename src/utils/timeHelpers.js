/**
 * Helper: diferencia en minutos entre dos ISO datetimes
 * Devuelve número (puede ser decimal), redondeamos más adelante si se desea.
 */
export function minutesBetween(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end.getTime() - start.getTime();
  return diffMs / 60000;
}

/**
 * Helper: compara si una fecha ISO cae en la misma fecha (UTC) que la fecha objetivo.
 * dateIso: "2025-12-09T19:12:00Z"
 * targetDate: "2025-12-09" OR full ISO "2025-12-09T00:00:00Z"
 */
export function isSameUtcDate(dateIso, targetDate) {
  const d = new Date(dateIso);
  // Normalize targetDate to YYYY-MM-DD
  let target;
  if (!targetDate) {
    // if no target provided, compare to today's UTC date
    const now = new Date();
    target = now.toISOString().slice(0, 10);
  } else {
    // If targetDate includes time, take first 10 chars
    target = targetDate.slice(0, 10);
  }
  return d.toISOString().slice(0, 10) === target;
}

/**
 * Add days to a date
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Parse ISO date string
 */
export function parseISO(dateString) {
  return new Date(dateString);
}

/**
 * Start of day (00:00:00)
 */
export function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * End of day (23:59:59)
 */
export function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Format date to ISO string
 */
export function formatISO(date) {
  return date.toISOString();
}

/**
 * Build date buckets based on granularity
 */
export function buildDateBuckets(start, end, granularity = 'daily') {
  const buckets = [];
  const current = new Date(start);
  
  while (current <= end) {
    buckets.push(new Date(current));
    
    if (granularity === 'daily') {
      current.setDate(current.getDate() + 1);
    } else if (granularity === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (granularity === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return buckets;
}

/**
 * Get date key for map
 */
export function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Calculate duration in seconds for an order
 */
export function durationSecondsForOrder(order) {
  const start = order.createdAt;
  const end = order.finishedAt || order.completedAt;
  
  if (!start || !end) return null;
  
  const startDate = new Date(start);
  const endDate = new Date(end);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  
  return Math.round((endDate.getTime() - startDate.getTime()) / 1000);
}

/**
 * Compute SLA compliance for durations
 */
export function computeSlaComplianceForDurations(durations, slaRules) {
  if (!durations.length || !slaRules.length) return null;
  
  // Find the relevant SLA rule (assuming first rule or by some criteria)
  const rule = slaRules[0];
  const thresholdMinutes = rule.tiempo_maximo || 10; // Default 10 minutes
  const thresholdSeconds = thresholdMinutes * 60;
  
  const compliantCount = durations.filter(d => d <= thresholdSeconds).length;
  const compliancePercentage = (compliantCount / durations.length) * 100;
  
  return Math.round(compliancePercentage);
}