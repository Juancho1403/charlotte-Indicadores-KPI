// Mock data for external services used by KPI module
// ============================================
// MÓDULO: ATENCIÓN AL CLIENTE (ATC)
// ============================================

export async function fetchComandas(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'C-1', 
      order_id: 'C-1', 
      created_at: now.toISOString(), 
      createdAt: now.toISOString(),
      timestamp_creation: now.toISOString(), 
      total: 25.5,
      monto_total: 25.5, 
      waiter_id: 'w1', 
      status: 'CLOSED',
      lines: [
        { product_id: 'p1', qty: 1, price: 10.0 }, 
        { product_id: 'p2', qty: 1, price: 15.5 }
      ], 
      prep_time_seconds: 120 
    },
    { 
      id: 'C-2', 
      order_id: 'C-2', 
      created_at: now.toISOString(),
      createdAt: now.toISOString(),
      timestamp_creation: now.toISOString(), 
      total: 12.0,
      monto_total: 12.0, 
      waiter_id: 'w2', 
      status: 'CLOSED',
      lines: [{ product_id: 'p3', qty: 2, price: 6.0 }], 
      prep_time_seconds: 90 
    }
  ];
}

export async function fetchComandaById(id) {
  const now = new Date();
  return { 
    id, 
    order_id: id, 
    created_at: now.toISOString(),
    createdAt: now.toISOString(),
    timestamp_creation: now.toISOString(), 
    total: 30.0,
    monto_total: 30.0, 
    waiter_id: 'w1', 
    status: 'CLOSED',
    lines: [] 
  };
}

export async function fetchMesas(params = {}) {
  return [
    { id: 'M-1', numero: 1, status: 'OCCUPIED', capacidad: 4 },
    { id: 'M-2', numero: 2, status: 'AVAILABLE', capacidad: 2 },
    { id: 'M-3', numero: 3, status: 'OCCUPIED', capacidad: 6 }
  ];
}

export async function fetchSesiones(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'S-1', 
      mesa_id: 'M-1', 
      created_at: new Date(now.getTime() - 30 * 60000).toISOString(),
      closed_at: now.toISOString()
    },
    { 
      id: 'S-2', 
      mesa_id: 'M-3', 
      created_at: new Date(now.getTime() - 15 * 60000).toISOString(),
      closed_at: null
    }
  ];
}

export async function fetchClienteTemporal(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'CT-1', 
      mesa_id: 'M-1',
      created_at: new Date(now.getTime() - 45 * 60000).toISOString(),
      createdAt: new Date(now.getTime() - 45 * 60000).toISOString(),
      closed_at: now.toISOString(),
      closedAt: now.toISOString()
    },
    { 
      id: 'CT-2', 
      mesa_id: 'M-2',
      created_at: new Date(now.getTime() - 20 * 60000).toISOString(),
      createdAt: new Date(now.getTime() - 20 * 60000).toISOString(),
      closed_at: null,
      closedAt: null
    }
  ];
}

export async function fetchServiceRequests(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'SR-1', 
      mesa_id: 'M-1', 
      tipo: 'ATENCION',
      created_at: new Date(now.getTime() - 10 * 60000).toISOString(),
      atendido_at: new Date(now.getTime() - 5 * 60000).toISOString(),
      status: 'RESOLVED'
    },
    { 
      id: 'SR-2', 
      mesa_id: 'M-3', 
      tipo: 'CUENTA',
      created_at: new Date(now.getTime() - 5 * 60000).toISOString(),
      atendido_at: null,
      status: 'PENDING'
    }
  ];
}

// ============================================
// MÓDULO: COCINA (KDS)
// ============================================

export async function fetchKdsQueue(params = {}) {
  const now = new Date();
  return [
    { 
      task_id: 't1', 
      id: 't1',
      status: 'PENDING', 
      station: 'grill', 
      external_order_id: 'C-1', 
      comanda_id: 'C-1',
      created_at: now.toISOString(),
      timestamp_creation: now.toISOString() 
    }
  ];
}

export async function fetchKdsHistory(params = {}) {
  const now = new Date();
  const sentAt = new Date(now.getTime() - 10 * 60000);
  const deliveredAt = new Date(now.getTime() - 5 * 60000);
  return [
    { 
      task_id: 't1', 
      id: 't1',
      status: 'DELIVERED', 
      station: 'grill', 
      external_order_id: 'C-1',
      comanda_id: 'C-1',
      sent_at: sentAt.toISOString(),
      delivered_at: deliveredAt.toISOString(),
      created_at: sentAt.toISOString(), 
      ready_at: deliveredAt.toISOString(),
      deliveredAt: deliveredAt.toISOString()
    }
  ];
}

export async function fetchKdsComandas(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'KC-1', 
      comanda_id: 'C-1',
      status: 'READY',
      sent_at: new Date(now.getTime() - 10 * 60000).toISOString(),
      delivered_at: new Date(now.getTime() - 5 * 60000).toISOString(),
      deliveredAt: new Date(now.getTime() - 5 * 60000).toISOString()
    },
    { 
      id: 'KC-2', 
      comanda_id: 'C-2',
      status: 'DELIVERED',
      sent_at: new Date(now.getTime() - 15 * 60000).toISOString(),
      delivered_at: new Date(now.getTime() - 8 * 60000).toISOString(),
      deliveredAt: new Date(now.getTime() - 8 * 60000).toISOString()
    }
  ];
}

export async function fetchRecetas(params = {}) {
  return [
    { 
      id: 'R-1', 
      product_id: 'p1', 
      name: 'Charlotte Burger Recipe',
      ingredients: [
        { item_id: 'i1', quantity: 2 },
        { item_id: 'i2', quantity: 1 }
      ]
    }
  ];
}

export async function fetchInventoryConsumption(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'IC-1', 
      product_id: 'p1',
      item_id: 'i1',
      quantity: 2,
      consumed_at: now.toISOString(),
      comanda_id: 'C-1'
    }
  ];
}

export async function fetchStaff(params = {}) {
  return [
    { id: 'w1', name: 'Ana García', shift: 'MORNING', status: 'ACTIVE' },
    { id: 'w2', name: 'Luis Pérez', shift: 'EVENING', status: 'ACTIVE' },
    { id: 'w3', name: 'Sofia Torres', shift: 'MORNING', status: 'ACTIVE' }
  ];
}

// ============================================
// MÓDULO: DELIVERY/PICKUP (DP)
// ============================================

export async function fetchDeliveryOrders(params = {}) {
  const now = new Date();
  return [
    { 
      order_id: 'D-1', 
      id: 'D-1',
      timestamp_creation: now.toISOString(),
      created_at: now.toISOString(),
      monto_total: 18.5,
      total_amount: 18.5,
      current_status: 'DELIVERED',
      status: 'DELIVERED',
      lines: [{ product_id: 'p1', qty: 1, price: 18.5 }] 
    },
    { 
      order_id: 'D-2', 
      id: 'D-2',
      timestamp_creation: now.toISOString(),
      created_at: now.toISOString(),
      monto_total: 25.0,
      total_amount: 25.0,
      current_status: 'DELIVERED',
      status: 'DELIVERED',
      lines: [{ product_id: 'p2', qty: 2, price: 12.5 }] 
    }
  ];
}

export async function fetchDpNotes(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'DPN-1', 
      note_id: 'DPN-1',
      monto_total: 18.5,
      total_amount: 18.5,
      status: 'PAID',
      created_at: now.toISOString(),
      paid_at: now.toISOString()
    },
    { 
      id: 'DPN-2', 
      note_id: 'DPN-2',
      monto_total: 25.0,
      total_amount: 25.0,
      status: 'PAID',
      created_at: now.toISOString(),
      paid_at: now.toISOString()
    }
  ];
}

export async function fetchDpNoteById(id) {
  const now = new Date();
  return { 
    id, 
    note_id: id,
    monto_total: 18.5,
    total_amount: 18.5,
    status: 'PAID',
    created_at: now.toISOString(),
    paid_at: now.toISOString()
  };
}

export async function fetchDpNoteItems(noteId, params = {}) {
  return [
    { 
      id: 'DPNI-1', 
      note_id: noteId,
      product_id: 101,
      name: 'Charlotte Burger',
      quantity: 1,
      subtotal: 18.5,
      price: 18.5
    },
    { 
      id: 'DPNI-2', 
      note_id: noteId,
      product_id: 102,
      name: 'Avocado Toast',
      quantity: 1,
      subtotal: 12.0,
      price: 12.0
    }
  ];
}

export async function fetchAllDpNoteItems(params = {}) {
  return [
    { 
      id: 'DPNI-1', 
      note_id: 'DPN-1',
      product_id: 101,
      name: 'Charlotte Burger',
      quantity: 1,
      subtotal: 18.5,
      price: 18.5
    },
    { 
      id: 'DPNI-2', 
      note_id: 'DPN-1',
      product_id: 102,
      name: 'Avocado Toast',
      quantity: 2,
      subtotal: 24.0,
      price: 12.0
    },
    { 
      id: 'DPNI-3', 
      note_id: 'DPN-2',
      product_id: 101,
      name: 'Charlotte Burger',
      quantity: 3,
      subtotal: 55.5,
      price: 18.5
    }
  ];
}

export async function fetchDpPayments(params = {}) {
  const now = new Date();
  return [
    { 
      id: 'PAY-1', 
      note_id: 'DPN-1',
      amount: 18.5,
      payment_method: 'CASH',
      paid_at: now.toISOString(),
      status: 'COMPLETED'
    },
    { 
      id: 'PAY-2', 
      note_id: 'DPN-2',
      amount: 25.0,
      payment_method: 'CARD',
      paid_at: now.toISOString(),
      status: 'COMPLETED'
    }
  ];
}

// ============================================
// MÓDULO: INVENTARIO
// ============================================

export async function fetchInventoryItems(params = {}) {
  return [
    { 
      id: 'i1', 
      name: 'Tomate', 
      quantity_on_hand: 5, 
      reorder_threshold: 10,
      min_stock: 10,
      current_level_pct: 50
    },
    { 
      id: 'i2', 
      name: 'Lechuga', 
      quantity_on_hand: 20, 
      reorder_threshold: 5,
      min_stock: 5,
      current_level_pct: 100
    },
    { 
      id: 'i3', 
      name: 'Queso', 
      quantity_on_hand: 2, 
      reorder_threshold: 10,
      min_stock: 10,
      current_level_pct: 20
    }
  ];
}

export async function fetchProducts(params = {}) {
  return [
    { id: 'p1', product_id: 101, name: 'Charlotte Burger', price: 18.5 },
    { id: 'p2', product_id: 102, name: 'Avocado Toast', price: 12.0 },
    { id: 'p3', product_id: 103, name: 'Cappuccino', price: 6.0 }
  ];
}
