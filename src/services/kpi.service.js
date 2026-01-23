import * as consumers from './consumers/externalConsumers.js';

export async function getDashboardSummary(query = {}) {
  // Collect basic metrics from multiple services in parallel
  const [comandas, deliveryOrders, kdsQueue, inventoryItems] = await Promise.all([
    consumers.fetchComandas({ date: query.date }),
    consumers.fetchDeliveryOrders({ date: query.date }),
    consumers.fetchKdsQueue(),
    consumers.fetchInventoryItems()
  ].map(p => p.catch ? p : Promise.resolve([])));

  // Normalize and compute minimal KPIs
  const sumAmount = (arr) => (Array.isArray(arr) ? arr.reduce((s, o) => s + (o.monto_total || 0), 0) : 0);
  const totalSales = sumAmount(comandas) + sumAmount(deliveryOrders);
  const totalOrders = (Array.isArray(comandas) ? comandas.length : 0) + (Array.isArray(deliveryOrders) ? deliveryOrders.length : 0);
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;

  return {
    totalSales,
    totalOrders,
    avgTicket,
    kdsQueueLength: Array.isArray(kdsQueue) ? kdsQueue.length : (kdsQueue?.queue?.length ?? 0),
    inventoryLowCount: Array.isArray(inventoryItems) ? inventoryItems.filter(i => i.quantity_on_hand <= (i.reorder_threshold || 0)).length : 0
  };
}

export async function getStaffPerformance({ staff_id, from, to } = {}) {
  // Fetch staff and comandas and compute simple metrics
  const [staffList, comandas] = await Promise.all([
    consumers.fetchStaff(),
    consumers.fetchComandas({ from, to })
  ].map(p => p.catch ? p : Promise.resolve([])));

  // If staff_id provided, filter and compute
  const ordersByStaff = (staff_id)
    ? (comandas || []).filter(c => String(c.waiter_id) === String(staff_id))
    : (comandas || []);

  const ordersCount = ordersByStaff.length;
  const avgPrepTime = ordersByStaff.reduce((acc, o) => acc + (o.prep_time_seconds || 0), 0) / (ordersCount || 1);

  return {
    staffCount: Array.isArray(staffList) ? staffList.length : 0,
    ordersCount,
    avgPrepTime
  };
}

export async function getKitchenQueue() {
  const queue = await consumers.fetchKdsQueue();
  return { queue }; 
}

export async function getTopProducts({ period = '7d', limit = 10 } = {}) {
  // Gather sales from comandas and delivery
  const [comandas, deliveryOrders, products] = await Promise.all([
    consumers.fetchComandas({ period }),
    consumers.fetchDeliveryOrders({ period }),
    consumers.fetchProducts()
  ].map(p => p.catch ? p : Promise.resolve([])));

  const lines = [];
  const collectLines = (orders) => {
    if (!Array.isArray(orders)) return;
    for (const o of orders) {
      if (Array.isArray(o.lines)) {
        for (const l of o.lines) {
          lines.push({ product_id: l.product_id, qty: l.qty || 0, price: l.price || 0 });
        }
      }
    }
  };
  collectLines(comandas);
  collectLines(deliveryOrders);

  const agg = lines.reduce((acc, l) => {
    acc[l.product_id] = acc[l.product_id] || { qty: 0, revenue: 0 };
    acc[l.product_id].qty += l.qty;
    acc[l.product_id].revenue += (l.qty * l.price);
    return acc;
  }, {});

  const result = Object.entries(agg).map(([product_id, v]) => ({ product_id, ...v }));
  result.sort((a, b) => b.qty - a.qty);

  return { top: result.slice(0, Number(limit)), productCatalogCount: Array.isArray(products) ? products.length : 0 };
}
