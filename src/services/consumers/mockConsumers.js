// Mock data for external services used by KPI module
export async function fetchComandas(params = {}) {
  return [
    { order_id: 'C-1', timestamp_creation: new Date().toISOString(), monto_total: 25.5, waiter_id: 'w1', lines: [{ product_id: 'p1', qty: 1, price: 10.0 }, { product_id: 'p2', qty: 1, price: 15.5 }], prep_time_seconds: 120 },
    { order_id: 'C-2', timestamp_creation: new Date().toISOString(), monto_total: 12.0, waiter_id: 'w2', lines: [{ product_id: 'p3', qty: 2, price: 6.0 }], prep_time_seconds: 90 }
  ];
}

export async function fetchComandaById(id) {
  return { order_id: id, timestamp_creation: new Date().toISOString(), monto_total: 30.0, waiter_id: 'w1', lines: [] };
}

export async function fetchKdsQueue() {
  return [{ task_id: 't1', status: 'PENDING', station: 'grill', external_order_id: 'C-1', timestamp_creation: new Date().toISOString() }];
}

export async function fetchKdsHistory() {
  return [{ task_id: 't1', status: 'READY', station: 'grill', external_order_id: 'C-1', created_at: new Date().toISOString(), ready_at: new Date().toISOString() }];
}

export async function fetchInventoryItems(params = {}) {
  return [
    { id: 'i1', name: 'Tomate', quantity_on_hand: 5, reorder_threshold: 10 },
    { id: 'i2', name: 'Lechuga', quantity_on_hand: 20, reorder_threshold: 5 }
  ];
}

export async function fetchProducts(params = {}) {
  return [
    { id: 'p1', name: 'Charlotte Burger' },
    { id: 'p2', name: 'Avocado Toast' }
  ];
}

export async function fetchStaff(params = {}) {
  return [
    { id: 'w1', name: 'Ana García' },
    { id: 'w2', name: 'Luis Pérez' }
  ];
}

export async function fetchDeliveryOrders(params = {}) {
  return [
    { order_id: 'D-1', timestamp_creation: new Date().toISOString(), monto_total: 18.5, current_status: 'DELIVERED', lines: [{ product_id: 'p1', qty: 1, price: 18.5 }] }
  ];
}
