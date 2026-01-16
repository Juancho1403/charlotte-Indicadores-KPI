import dayjs from 'dayjs';

// Helpers estadísticos
function median(values) {
  const arr = [...values].sort((a,b) => a-b);
  const n = arr.length;
  if (n === 0) return 0;
  const mid = Math.floor(n/2);
  return (n % 2 === 0) ? (arr[mid-1] + arr[mid]) / 2 : arr[mid];
}

function quantile(values, q) {
  const arr = [...values].sort((a,b) => a-b);
  if (!arr.length) return 0;
  const pos = (arr.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (arr[base + 1] !== undefined) return arr[base] + rest * (arr[base + 1] - arr[base]);
  return arr[base];
}

function handleOutliers(valuesInput, k = 2, strategy = 'adjust') {
  // normalizar a números y filtrar no-numéricos
  const values = Array.isArray(valuesInput) ? valuesInput.map(v => Number(v)).filter(v => isFinite(v)) : [];
  if (!values.length) {
    return { processed: [], outliersCount: 0, mu: 0, sd: 0, lower: 0, upper: 0 };
  }

  // Fallback robusto para muestras pequeñas
  if (values.length < 4) {
    const med = median(values);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const ratioThreshold = 10; // configurable
    let outliersCount = 0;

    const processed = values
      .map(v => {
        // si med == 0, evitamos división por cero; en ese caso no marcamos por ratio
        if (med > 0 && (v / med) >= ratioThreshold) {
          outliersCount++;
          if (strategy === 'exclude') return null;
          if (strategy === 'adjust') return med * ratioThreshold;
        }
        if (med > 0 && (med / (v || 1)) >= ratioThreshold) {
          outliersCount++;
          if (strategy === 'exclude') return null;
          if (strategy === 'adjust') return med / ratioThreshold;
        }
        return v;
      })
      .filter(v => v !== null);

    return { processed, outliersCount, mu: med, sd: 0, lower: min, upper: max };
  }

  // Para muestras >= 4 usamos IQR
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr * k;
  const upper = q3 + 1.5 * iqr * k;

  let outliersCount = 0;
  const processed = values
    .map(v => {
      if (v < lower || v > upper) {
        outliersCount++;
        if (strategy === 'exclude') return null;
        if (strategy === 'adjust') return Math.max(lower, Math.min(upper, v));
      }
      return v;
    })
    .filter(v => v !== null);

  const mu = median(values);
  const sd = quantile(values, mu);

  return { processed, outliersCount, mu, sd, lower, upper };
}

/**
 * computeKpiSnapshot
 * - inputs:
 *    - clients: array de objetos /clients
 *    - comandas: array de objetos /comandas
 *    - options: { outlierK, outlierStrategy, timezone, targetDay (Date or dayjs) }
 * - returns: objeto con snapshot calculado (no persiste)
 */
export async function computeKpiSnapshot(clients = [], comandas = [], options = {}) {
  const {
    outlierK = 2,
    outlierStrategy = 'adjust',
    timezone = 'UTC',
    targetDay = dayjs().tz ? dayjs().tz(timezone).subtract(1, 'day').startOf('day') : dayjs().subtract(1, 'day').startOf('day'),
  } = options;

  const start = (targetDay && targetDay.toDate) ? targetDay.toDate() : new Date(targetDay);
  const end = (targetDay && targetDay.endOf) ? targetDay.endOf('day').toDate() : new Date(start.getTime() + 24*60*60*1000 - 1);

  // Filtrar clientes cerrados en rango
  const closedClients = clients.filter(c => c.status === 'CLOSED' && c.closed_at);
  
  // Ingresos
  const revenues = closedClients
    .map(c => {
      const v = Number(c.total_amount ?? 0);
      return isNaN(v) ? 0 : v;
    })
    .filter(v => v >= 0);

  // Service times (ms)
  const serviceTimesMs = [];
  comandas.forEach(cmd => {
    const m = cmd.metrics || {};
    if (typeof m.service_time_minutes === 'number') {
      serviceTimesMs.push(m.service_time_minutes * 60000);
    } else if (typeof m.elapsed_minutes === 'number') {
      serviceTimesMs.push(m.elapsed_minutes * 60000);
    } else if (cmd.sent_at && cmd.delivered_at) {
      const sent = new Date(cmd.sent_at).getTime();
      const delivered = new Date(cmd.delivered_at).getTime();
      if (!isNaN(sent) && !isNaN(delivered) && delivered >= sent) {
        serviceTimesMs.push(delivered - sent);
      }
    }
  });

  // Rotación de mesas
  const tableIdsFromComandas = new Set(comandas.map(c => c.table_number).filter(Boolean));
  const tableIdsFromClients = new Set(closedClients.map(c => c.tableId || c.table_number).filter(Boolean));
  const distinctTables = new Set([...tableIdsFromComandas, ...tableIdsFromClients]);
  const tableRotations = Math.max(closedClients.length, comandas.length);
  const distinctTablesCount = distinctTables.size || 1;
  const rotacionMesasIndice = tableRotations / distinctTablesCount;

  // Outliers
  const revenueOut = handleOutliers(revenues, outlierK, outlierStrategy);
  const serviceOut = handleOutliers(serviceTimesMs, outlierK, outlierStrategy);

  // Cálculos finales
  const totalRevenue = revenueOut.processed.reduce((a, b) => a + b, 0);
  const totalPedidos = revenueOut.processed.length;
  const avgServiceMs = serviceOut.processed.length ? median(serviceOut.processed) : 0;
  const avgServiceMin = avgServiceMs / 60000;
  const ticketPromedio = totalPedidos ? totalRevenue / totalPedidos : 0;
  const outliersCount = revenueOut.outliersCount + serviceOut.outliersCount;

  const metadata = {
    dateRange: { start, end },
    outlierConfig: { k: outlierK, strategy: outlierStrategy },
    revenueStats: {
      rawCount: revenues.length,
      processedCount: revenueOut.processed.length,
      mu: revenueOut.mu,
      sd: revenueOut.sd,
      lower: revenueOut.lower,
      upper: revenueOut.upper,
    },
    serviceStats: {
      rawCount: serviceTimesMs.length,
      processedCount: serviceOut.processed.length,
      muMs: serviceOut.mu,
      sdMs: serviceOut.sd,
      lowerMs: serviceOut.lower,
      upperMs: serviceOut.upper,
    },
    tables: {
      distinctTables: Array.from(distinctTables).slice(0, 50),
      distinctTablesCount,
    },
    sourceCounts: {
      clients: closedClients.length,
      comandas: comandas.length
    }
  };

  return {
    fechaCorte: start,
    totalVentas: Number(totalRevenue.toFixed(2)),
    totalPedidos,
    tiempoPromedioMin: Number(avgServiceMin.toFixed(2)),
    rotacionMesasIndice: Number(rotacionMesasIndice.toFixed(2)),
    ticketPromedio: Number(ticketPromedio.toFixed(2)),
    alertasGeneradas: outliersCount,
    metadata,
  };
}
