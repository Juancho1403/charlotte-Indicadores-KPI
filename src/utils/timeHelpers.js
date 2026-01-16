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