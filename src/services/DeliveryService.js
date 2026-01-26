import { BaseHttpService } from './http/BaseHttpService.js';
import { API_ENDPOINTS } from '../config/apiEndpoints.js';

export class DeliveryService extends BaseHttpService {
  constructor() {
    super('Delivery', API_ENDPOINTS.DELIVERY.BASE_URL);
  }

  // Orders
  async getOrders(params = {}) {
    return this.get(API_ENDPOINTS.DELIVERY.ENDPOINTS.ORDERS, params);
  }

  async getOrderById(id) {
    return this.get(`${API_ENDPOINTS.DELIVERY.ENDPOINTS.ORDERS}/${id}`);
  }

  // Dashboard
  async getDashboardMetrics(params = {}) {
    return this.get(API_ENDPOINTS.DELIVERY.ENDPOINTS.DASHBOARD, params);
  }

  // Thresholds
  async getThresholds(params = {}) {
    return this.get(API_ENDPOINTS.DELIVERY.ENDPOINTS.THRESHOLDS, params);
  }

  // Métricas específicas
  async getDeliveryMetrics(dateFrom, dateTo) {
    const [orders, dashboard] = await Promise.all([
      this.getOrders({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        status: 'COMPLETED',
      }),
      this.getDashboardMetrics({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      }),
    ]);

    // Procesar métricas de órdenes
    let totalRevenue = 0;
    let orderCount = 0;
    const revenueByType = {};
    const deliveryTimes = [];

    if (orders.data && orders.data.length > 0) {
      orders.data.forEach(order => {
        totalRevenue += parseFloat(order.totalAmount || 0);
        orderCount++;

        // Agrupar por tipo de pedido (delivery/pickup)
        const orderType = order.orderType || 'unknown';
        if (!revenueByType[orderType]) {
          revenueByType[orderType] = 0;
        }
        revenueByType[orderType] += parseFloat(order.totalAmount || 0);

        // Calcular tiempo de entrega si está disponible
        if (order.createdAt && order.deliveredAt) {
          const created = new Date(order.createdAt);
          const delivered = new Date(order.deliveredAt);
          deliveryTimes.push((delivered - created) / 60000); // en minutos
        }
      });
    }

    // Calcular tiempo promedio de entrega
    const avgDeliveryTime = deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 0;

    // Obtener umbrales
    const thresholds = await this.getThresholds();
    const deliveryThreshold = thresholds.data?.find(t => t.metric === 'DELIVERY_TIME');
    
    // Determinar estado basado en umbrales
    let deliveryStatus = 'NORMAL';
    if (deliveryThreshold) {
      if (avgDeliveryTime > deliveryThreshold.criticalValue) {
        deliveryStatus = 'CRITICAL';
      } else if (avgDeliveryTime > deliveryThreshold.warningValue) {
        deliveryStatus = 'WARNING';
      }
    }

    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      orderCount,
      averageOrderValue: orderCount > 0 ? parseFloat((totalRevenue / orderCount).toFixed(2)) : 0,
      revenueByType,
      deliveryPerformance: {
        averageTime: parseFloat(avgDeliveryTime.toFixed(2)),
        status: deliveryStatus,
        sampleSize: deliveryTimes.length,
      },
      dashboardMetrics: dashboard.data || {},
    };
  }

  async getOrderStatusDistribution(dateFrom, dateTo) {
    const orders = await this.getOrders({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    });

    const statusCounts = {};
    let totalOrders = 0;

    if (orders.data && orders.data.length > 0) {
      orders.data.forEach(order => {
        const status = order.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        totalOrders++;
      });
    }

    // Calcular porcentajes
    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: parseFloat(((count / totalOrders) * 100).toFixed(1)),
    }));

    // Ordenar por cantidad (de mayor a menor)
    statusDistribution.sort((a, b) => b.count - a.count);

    return {
      totalOrders,
      statusDistribution,
      startDate: dateFrom.toISOString(),
      endDate: dateTo.toISOString(),
    };
  }
}
