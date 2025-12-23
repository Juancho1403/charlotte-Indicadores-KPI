import { startOfDay, addDays, format } from 'date-fns';

/**
 * Helper: build array of date buckets (daily) between two dates inclusive
 */
export function buildDateBuckets(dateFrom, dateTo, granularity = 'daily') {
  const buckets = [];
  let cur = startOfDay(dateFrom);
  const end = startOfDay(dateTo);

  if (granularity === 'daily') {
    while (cur <= end) {
      buckets.push(new Date(cur));
      cur = addDays(cur, 1);
    }
    return buckets;
  }

  if (granularity === 'weekly') {
    while (cur <= end) {
      buckets.push(new Date(cur));
      cur = addDays(cur, 7);
    }
    return buckets;
  }

  if (granularity === 'monthly') {
    while (cur <= end) {
      buckets.push(new Date(cur));
      cur = addDays(cur, 30);
    }
    return buckets;
  }

  while (cur <= end) {
    buckets.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return buckets;
}

export function dateKey(d) {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Compute SLA compliance for a list of order durations (in seconds) using rules.
 */
export function computeSlaComplianceForDurations(durationsSeconds = [], rules = []) {
  if (!durationsSeconds.length) return null;

  const rule =
    rules.find((r) => {
      const t = String(r.tipoMetrica || '').toLowerCase();
      return t === 'avg_time' || t === 'avgtime' || t === 'average_time' || t === 'average' || t === 'avg';
    }) || rules.find(() => true);

  if (!rule || rule.umbralAmbar == null) return null;

  const amberThreshold = Number(rule.umbralAmbar);
  if (Number.isNaN(amberThreshold)) return null;

  const compliantCount = durationsSeconds.filter((s) => s <= amberThreshold).length;
  return Math.round((compliantCount / durationsSeconds.length) * 100);
}

export function durationSecondsForOrder(o) {
  const startT = o.createdAt ? new Date(o.createdAt).getTime() : null;
  const endT = o.finishedAt ? new Date(o.finishedAt).getTime() : o.completedAt ? new Date(o.completedAt).getTime() : null;
  if (!startT || !endT) return null;
  const diffMs = endT - startT;
  if (diffMs < 0) return null;
  return Math.round(diffMs / 1000);
}