import axios from 'axios';
import { envs } from '../../config/envs.js';

let mock;
if (envs.USE_MOCK_SERVICES) {
  // Lazy import mock consumers
  // eslint-disable-next-line import/no-unresolved
  mock = await import('./mockConsumers.js');
}

const axiosJson = axios.create({ timeout: 8000 });

// ============================================
// MÓDULO: ATENCIÓN AL CLIENTE (ATC)
// ============================================

/**
 * Obtener comandas del módulo Atención al Cliente
 * @param {Object} params - Query params: date, status, waiter_id, etc.
 * @returns {Promise<Array>} Lista de comandas
 */
export async function fetchComandas(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchComandas(params);
  const url = `${envs.AT_CLIENT_BASE_URL}/comandas`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener una comanda específica por ID
 * @param {string|number} id - ID de la comanda
 * @returns {Promise<Object>} Datos de la comanda
 */
export async function fetchComandaById(id) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchComandaById(id);
  const url = `${envs.AT_CLIENT_BASE_URL}/comandas/${id}`;
  const res = await axiosJson.get(url);
  return res.data;
}

/**
 * Obtener mesas (tables) del módulo ATC
 * Endpoint: GET /api/v1/atencion-cliente/tables
 * @param {Object} params - Query params: status, store_id, etc.
 * @returns {Promise<Array>} Lista de mesas
 */
export async function fetchMesas(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchMesas(params);
  const url = `${envs.AT_CLIENT_BASE_URL}/tables`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener sesiones de clientes
 * @param {Object} params - Query params: date, table_id, etc.
 * @returns {Promise<Array>} Lista de sesiones
 */
export async function fetchSesiones(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchSesiones(params);
  const url = `${envs.AT_CLIENT_BASE_URL}/sesiones`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener clientes (cliente_temporal) para calcular tiempo promedio de servicio
 * Endpoint: GET /api/v1/atencion-cliente/clients
 * @param {Object} params - Query params: date, table_id, active, etc.
 * @returns {Promise<Array>} Lista de registros cliente_temporal
 */
export async function fetchClienteTemporal(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchClienteTemporal(params);
  const url = `${envs.AT_CLIENT_BASE_URL}/clients`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener service-requests (solicitudes de servicio)
 * @param {Object} params - Query params: date, status, waiter_id, etc.
 * @returns {Promise<Array>} Lista de service requests
 */
export async function fetchServiceRequests(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchServiceRequests(params);
  const url = `${envs.AT_CLIENT_BASE_URL}/service-requests`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

// ============================================
// MÓDULO: COCINA (KDS)
// ============================================

/**
 * Obtener cola de KDS (Kitchen Display System)
 * Endpoint: GET /api/kitchen/kds/queue
 * @param {Object} params - Query params: status, station, etc.
 * @returns {Promise<Array>} Lista de órdenes en cola
 */
export async function fetchKdsQueue(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchKdsQueue(params);
  const url = `${envs.KDS_BASE_URL}/kds/queue`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener historial de KDS (comandas con estados READY/DELIVERED)
 * Endpoint: GET /api/kitchen/kds/history
 * @param {Object} params - Query params: date, status, sent_at, delivered_at, etc.
 * @returns {Promise<Array>} Lista de comandas del historial
 */
export async function fetchKdsHistory(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchKdsHistory(params);
  const url = `${envs.KDS_BASE_URL}/kds/history`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener comandas de cocina con estados específicos
 * Nota: Las comandas vienen del módulo ATC, pero podemos usar KDS history para estados
 * @param {Object} params - Query params: status (READY, DELIVERED), date, etc.
 * @returns {Promise<Array>} Lista de comandas
 */
export async function fetchKdsComandas(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchKdsComandas(params);
  // Usar KDS history que contiene las comandas con estados
  const url = `${envs.KDS_BASE_URL}/kds/history`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener receta de un producto específico
 * Endpoint: GET /api/kitchen/products/{id}/recipe
 * @param {string|number} productId - ID del producto
 * @returns {Promise<Object>} Receta del producto
 */
export async function fetchRecetaByProductId(productId) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchRecetas({ product_id: productId });
  const url = `${envs.KDS_BASE_URL}/products/${productId}/recipe`;
  const res = await axiosJson.get(url);
  return res.data;
}

/**
 * Obtener recetas (recipes) del módulo Cocina
 * Nota: Las recetas se obtienen por producto, no hay endpoint general
 * @param {Object} params - Query params: product_id, etc.
 * @returns {Promise<Array>} Lista de recetas (requiere llamar por producto)
 */
export async function fetchRecetas(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchRecetas(params);
  // Si se proporciona product_id, obtener receta específica
  if (params.product_id) {
    return fetchRecetaByProductId(params.product_id);
  }
  // Si no, retornar array vacío (no hay endpoint general de recetas)
  return [];
}

/**
 * Obtener logs de consumo de inventario desde cocina
 * Endpoint: GET /api/kitchen/inventory/items/{id}/logs
 * @param {string|number} itemId - ID del item de inventario
 * @param {Object} params - Query params: date, etc.
 * @returns {Promise<Array>} Lista de logs de consumo
 */
export async function fetchInventoryItemLogs(itemId, params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchInventoryConsumption(params);
  const url = `${envs.KDS_BASE_URL}/inventory/items/${itemId}/logs`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener consumo de inventario desde cocina (outbound movements)
 * Endpoint: POST /api/kitchen/inventory/outbound (para registrar) o logs de items
 * @param {Object} params - Query params: date, product_id, etc.
 * @returns {Promise<Array>} Lista de consumos de inventario
 */
export async function fetchInventoryConsumption(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchInventoryConsumption(params);
  // Los consumos se obtienen de los logs de items de inventario
  // Por ahora retornamos array vacío, se puede implementar agregando logs de todos los items
  return [];
}

/**
 * Obtener personal/staff del módulo Cocina
 * Endpoint: GET /api/kitchen/staff
 * @param {Object} params - Query params: shift, status, active, etc.
 * @returns {Promise<Array>} Lista de personal
 */
export async function fetchStaff(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchStaff(params);
  // Si se solicita personal activo, usar endpoint específico
  if (params.active === true || params.active === 'true') {
    const url = `${envs.KDS_BASE_URL}/staff/active`;
    const res = await axiosJson.get(url);
    return res.data;
  }
  const url = `${envs.KDS_BASE_URL}/staff`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

// ============================================
// MÓDULO: DELIVERY/PICKUP (DP)
// ============================================

/**
 * Obtener órdenes de delivery/pickup
 * Endpoint: GET /api/dp/v1/orders
 * @param {Object} params - Query params: date, status, active, etc.
 * @returns {Promise<Array>} Lista de órdenes
 */
export async function fetchDeliveryOrders(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchDeliveryOrders(params);
  // Si se solicita órdenes activas, usar endpoint específico
  if (params.active === true || params.active === 'true') {
    const url = `${envs.DELIVERY_BASE_URL}/orders/active`;
    const res = await axiosJson.get(url);
    return res.data;
  }
  // Si se solicita por status, usar endpoint específico
  if (params.status) {
    const url = `${envs.DELIVERY_BASE_URL}/orders/status/${params.status}`;
    const res = await axiosJson.get(url);
    return res.data;
  }
  const url = `${envs.DELIVERY_BASE_URL}/orders`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener órdenes de delivery/pickup (equivalente a dp_notes) - usado para revenue calculation
 * Endpoint: GET /api/dp/v1/orders
 * Nota: En el módulo Delivery/Pickup, las "dp_notes" se manejan como "orders"
 * @param {Object} params - Query params: date, status, etc.
 * @returns {Promise<Array>} Lista de órdenes (dp_notes)
 */
export async function fetchDpNotes(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchDpNotes(params);
  // Las órdenes de delivery/pickup son equivalentes a dp_notes
  return fetchDeliveryOrders(params);
}

/**
 * Obtener una orden de delivery/pickup específica por ID (equivalente a dp_note)
 * Endpoint: GET /api/dp/v1/orders/{order_id}
 * @param {string|number} id - ID de la orden (UUID o DL-####)
 * @returns {Promise<Object>} Datos de la orden (dp_note)
 */
export async function fetchDpNoteById(id) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchDpNoteById(id);
  const url = `${envs.DELIVERY_BASE_URL}/orders/${id}`;
  const res = await axiosJson.get(url);
  return res.data;
}

/**
 * Obtener items de una orden de delivery/pickup (equivalente a dp_note_items)
 * Endpoint: GET /api/dp/v1/orders/{order_id} (incluye items en el detalle)
 * @param {string|number} orderId - ID de la orden
 * @param {Object} params - Query params adicionales
 * @returns {Promise<Array>} Lista de items de la orden
 */
export async function fetchDpNoteItems(orderId, params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchDpNoteItems(orderId, params);
  // Obtener detalle completo de la orden que incluye los items
  const order = await fetchDpNoteById(orderId);
  // Los items vienen en el campo 'items' o 'order_items' del objeto order
  return order?.items || order?.order_items || [];
}

/**
 * Obtener todos los items de órdenes de delivery/pickup en un rango de fechas (para análisis agregado)
 * Endpoint: GET /api/dp/v1/orders (y extraer items de cada orden)
 * @param {Object} params - Query params: date_from, date_to, status, etc.
 * @returns {Promise<Array>} Lista de todos los items de todas las órdenes
 */
export async function fetchAllDpNoteItems(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchAllDpNoteItems(params);
  // Obtener todas las órdenes en el rango de fechas
  const orders = await fetchDeliveryOrders(params);
  const ordersArray = Array.isArray(orders) ? orders : (orders?.data || []);
  
  // Extraer todos los items de todas las órdenes
  const allItems = [];
  ordersArray.forEach(order => {
    const items = order.items || order.order_items || [];
    items.forEach(item => {
      allItems.push({
        ...item,
        note_id: order.id || order.order_id,
        order_id: order.id || order.order_id,
        created_at: order.created_at || order.timestamp_creation
      });
    });
  });
  
  return allItems;
}

/**
 * Obtener pagos de delivery/pickup
 * Nota: Los pagos están incluidos en el detalle de las órdenes
 * Endpoint: GET /api/dp/v1/orders/{order_id} (incluye información de pago)
 * @param {Object} params - Query params: date, status, etc.
 * @returns {Promise<Array>} Lista de pagos (extraídos de órdenes)
 */
export async function fetchDpPayments(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchDpPayments(params);
  // Obtener órdenes pagadas
  const orders = await fetchDeliveryOrders({ ...params, status: 'PAID' });
  const ordersArray = Array.isArray(orders) ? orders : (orders?.data || []);
  
  // Extraer información de pago de cada orden
  return ordersArray
    .filter(order => order.payment_status === 'PAID' || order.status === 'PAID')
    .map(order => ({
      id: `PAY-${order.id}`,
      note_id: order.id || order.order_id,
      amount: order.total_amount || order.monto_total || order.total,
      payment_method: order.payment_method || 'UNKNOWN',
      paid_at: order.paid_at || order.updated_at || order.created_at,
      status: 'COMPLETED'
    }));
}

// ============================================
// MÓDULO: INVENTARIO (puede estar en Cocina o separado)
// ============================================

/**
 * Obtener items de inventario
 * Endpoint: GET /api/kitchen/inventory/items
 * @param {Object} params - Query params: name, min_stock, etc.
 * @returns {Promise<Array>} Lista de items de inventario
 */
export async function fetchInventoryItems(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchInventoryItems(params);
  const url = `${envs.INVENTORY_BASE_URL}/inventory/items`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}

/**
 * Obtener productos
 * Endpoint: GET /api/kitchen/products
 * @param {Object} params - Query params: name, category, status, etc.
 * @returns {Promise<Array>} Lista de productos
 */
export async function fetchProducts(params = {}) {
  if (envs.USE_MOCK_SERVICES) return mock.fetchProducts(params);
  const url = `${envs.KDS_BASE_URL}/products`;
  const res = await axiosJson.get(url, { params });
  return res.data;
}
