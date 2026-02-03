import * as consumers from './consumers/externalConsumers.js';

/**
 * Extraer ID de producto desde product_name con formato "Producto #id"
 */
const extractProductIdFromName = (productName) => {
  const match = productName.match(/^Producto #([a-f0-9-]+)$/i);
  return match ? match[1] : null;
};

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

export async function getIngredientFrequency({ date_from, date_to, period } = {}) {
  try {
    // Obtener comandas y productos (siguiendo la estructura de dashboard.service.js)
    const [comandasData, productsData] = await Promise.all([
      consumers.fetchComandas({}),
      consumers.fetchProducts({})
    ]);
    
    const comandas = Array.isArray(comandasData) ? comandasData : (comandasData?.data || []);
    const products = Array.isArray(productsData) ? productsData : (productsData?.data || []);

    // Filtrar comandas por rango de fechas si se proporciona
    let filteredComandas = comandas;
    if (date_from && date_to) {
      const startDate = new Date(date_from);
      const endDate = new Date(date_to);
      
      // Validar que el rango de fechas sea válido
      if (startDate > endDate) {
        return {
          success: false,
          error: 'Invalid date range: date_from must be earlier than or equal to date_to',
          timestamp: new Date().toISOString(),
          data: {
            date_from,
            date_to,
            message: 'Please ensure date_from is earlier than date_to'
          }
        };
      }
      
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      filteredComandas = comandas.filter(c => {
        const isValidStatus = c.status === 'DELIVERED' || 
                            c.status === 'PENDING' || 
                            c.status === 'CANCELLED' || 
                            c.status === 'CANCELED';
        
        if (!isValidStatus) return false;
        
        let createdDate;
        if (c.status === 'DELIVERED' && c.delivered_at) {
          createdDate = c.delivered_at;
        } else if ((c.status === 'PENDING' || c.status === 'CANCELLED' || c.status === 'CANCELED') && c.sent_at) {
          createdDate = c.sent_at;
        } else {
          return false;
        }
        
        if (!createdDate) return false;
        
        const date = new Date(createdDate);
        if (isNaN(date.getTime())) return false;
        
        return date >= startDate && date <= endDate;
      });
    }
    
    // Obtener también dp_notes (delivery/pickup) para análisis completo
    let dpNotes = [];
    try {
      const dpNotesData = await consumers.fetchDpNotes({});
      dpNotes = Array.isArray(dpNotesData) ? dpNotesData : (dpNotesData?.data || []);
      
      // Filtrar dp_notes por rango de fechas si se proporciona
      if (date_from && date_to) {
        const startDate = new Date(date_from);
        const endDate = new Date(date_to);
        
        // La validación de rango ya se hizo arriba, pero aquí también la necesitamos
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        dpNotes = dpNotes.filter(note => {
          const isValidStatus = note.current_status === 'EN_ROUTE' || 
                              note.current_status === 'PENDING_REVIEW' || 
                              note.current_status === 'IN_KITCHEN' || 
                              note.current_status === 'CANCELLED' || 
                              note.current_status === 'CANCELED' ||
                              note.current_status === 'DELIVERED';
          
          if (!isValidStatus) return false;
          
          const noteDate = note.created_at || note.timestamp_creation || '';
          if (!noteDate) return false;
          
          const date = new Date(noteDate);
          if (isNaN(date.getTime())) return false;
          
          return date >= startDate && date <= endDate;
        });
      }
    } catch (e) {
      console.warn("Error fetching dp_notes:", e.message);
    }
    
    // Recolectar productos de comandas y dp_notes
    const productFrequency = {};
    
    // Debug info para entender el filtrado
    const debugInfo = {
      original_comandas: comandas.length,
      filtered_comandas: filteredComandas.length,
      original_dp_notes: dpNotes.length,
      filtered_dp_notes: dpNotes.length,
      date_filter_applied: !!(date_from && date_to),
      date_range: { from: date_from, to: date_to }
    };
    
    // Procesar comandas
    for (const comanda of filteredComandas) {
      const lines = comanda.items || comanda.order_lines || [];
      
      if (Array.isArray(lines)) {
        for (const line of lines) {
          const qty = parseFloat(line.qty || line.quantity || 0);
          let productId = String(line.product_id || '');
          
          // IMPORTANTE: El product_id viene en el product_name con formato "Producto #id"
          const extractedId = extractProductIdFromName(line.product_name || '');
          if (extractedId) {
            productId = extractedId;
          }
          
          if (productId && qty > 0) {
            productFrequency[productId] = (productFrequency[productId] || 0) + qty;
          }
        }
      }
    }
    
    // Procesar dp_notes
    for (const note of dpNotes) {
      const lines = note.items || note.order_items || [];
      
      if (Array.isArray(lines)) {
        for (const line of lines) {
          const qty = parseFloat(line.qty || line.quantity || 0);
          let productId = String(line.product_id || '');
          
          // IMPORTANTE: El product_id viene en el product_name con formato "Producto #id"
          const extractedId = extractProductIdFromName(line.product_name || '');
          if (extractedId) {
            productId = extractedId;
          }
          
          if (productId && qty > 0) {
            productFrequency[productId] = (productFrequency[productId] || 0) + qty;
          }
        }
      }
    }
    
    // Para cada producto encontrado, obtener sus ingredientes
    const ingredientFrequency = {};
    const productDetailsArray = [];
    
    for (const [productId, quantity] of Object.entries(productFrequency)) {
      try {
        // Obtener receta del producto usando la URL proporcionada
        const recipeData = await consumers.fetchRecetaByProductId(productId);
        const recipe = recipeData?.data || recipeData;
        
        // La respuesta viene directamente como un array de ingredientes
        const ingredients = Array.isArray(recipe) ? recipe : (recipe?.ingredients || []);
        
        if (ingredients.length > 0) {
          // Guardar detalles del producto para referencia
          const productInfo = products.find(p => String(p.id) === productId);
          const productDetail = {
            product_id: productId,
            name: productInfo?.name || `Producto #${productId}`,
            quantity_used: quantity,
            ingredients_count: ingredients.length
          };
          productDetailsArray.push(productDetail);
          
          // Acumular frecuencia de ingredientes
          for (const ingredient of ingredients) {
            const ingredientId = String(ingredient.id || ingredient.ingredient_id);
            const ingredientName = ingredient.ingredientName || ingredient.name || `Ingrediente #${ingredientId}`;
            const ingredientQty = parseFloat(ingredient.qty || ingredient.quantity || ingredient.amount || 0);
            
            if (ingredientId && ingredientQty > 0) {
              if (!ingredientFrequency[ingredientId]) {
                ingredientFrequency[ingredientId] = {
                  name: ingredientName,
                  total_quantity: 0,
                  usage_count: 0,
                  used_in_products: []
                };
              }
              
              const totalIngredientQty = ingredientQty * quantity;
              ingredientFrequency[ingredientId].total_quantity += totalIngredientQty;
              ingredientFrequency[ingredientId].usage_count += 1;
              
              // Evitar duplicados en la lista de productos
              if (!ingredientFrequency[ingredientId].used_in_products.find(p => p.product_id === productId)) {
                ingredientFrequency[ingredientId].used_in_products.push({
                  product_id: productId,
                  product_name: productDetail.name,
                  product_quantity: quantity,
                  ingredient_per_unit: ingredientQty
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Error fetching recipe for product ${productId}:`, error.message);
        // Continuar con el siguiente producto
      }
    }
    
    // Convertir a array y ordenar por frecuencia de uso
    const result = Object.entries(ingredientFrequency).map(([ingredient_id, data]) => ({
      ingredient_id,
      ...data
    }));
    
    // Ordenar por cantidad total usada (descendente)
    result.sort((a, b) => b.total_quantity - a.total_quantity);
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        ingredient_frequency: result,
        summary: {
          total_unique_ingredients: result.length,
          total_products_analyzed: productDetailsArray.length,
          total_orders_analyzed: filteredComandas.length + dpNotes.length,
          date_range: {
            from: date_from || null,
            to: date_to || null
          }
        },
        product_details: productDetailsArray
      }
    };
    
  } catch (error) {
    console.error('Error in getIngredientFrequency:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}
