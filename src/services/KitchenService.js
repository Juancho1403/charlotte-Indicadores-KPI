import { BaseHttpService } from './http/BaseHttpService.js';
import { API_ENDPOINTS } from '../config/apiEndpoints.js';

export class KitchenService extends BaseHttpService {
  constructor() {
    super('Kitchen', API_ENDPOINTS.KITCHEN.BASE_URL);
  }

  // KDS Queue
  async getKdsQueue(params = {}) {
    return this.get(API_ENDPOINTS.KITCHEN.ENDPOINTS.KDS_QUEUE, params);
  }

  // KDS History
  async getKdsHistory(params = {}) {
    return this.get(API_ENDPOINTS.KITCHEN.ENDPOINTS.KDS_HISTORY, params);
  }

  // Staff
  async getStaff(params = {}) {
    return this.get(API_ENDPOINTS.KITCHEN.ENDPOINTS.STAFF, params);
  }

  async getStaffById(id) {
    return this.get(`${API_ENDPOINTS.KITCHEN.ENDPOINTS.STAFF}/${id}`);
  }

  // Products
  async getProducts(params = {}) {
    return this.get(API_ENDPOINTS.KITCHEN.ENDPOINTS.PRODUCTS, params);
  }

  // Inventory
  async getInventoryItems(params = {}) {
    return this.get(API_ENDPOINTS.KITCHEN.ENDPOINTS.INVENTORY_ITEMS, params);
  }

  // Métricos específicos
  async getCookingTimeMetrics(dateFrom, dateTo) {
    const history = await this.getKdsHistory({ 
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      status: 'COMPLETED'
    });

    if (!history.data || history.data.length === 0) {
      return { 
        averageCookingTime: 0, 
        totalOrders: 0,
        byStaff: {},
        byProduct: {}
      };
    }

    // Calcular tiempo promedio de cocina
    let totalTime = 0;
    const byStaff = {};
    const byProduct = {};
    const now = new Date();

    history.data.forEach(order => {
      const startTime = new Date(order.startedAt || order.createdAt);
      const endTime = new Date(order.completedAt || now);
      const duration = (endTime - startTime) / 60000; // en minutos
      
      totalTime += duration;

      // Agrupar por personal
      if (order.assignedTo) {
        if (!byStaff[order.assignedTo]) {
          byStaff[order.assignedTo] = { totalTime: 0, count: 0 };
        }
        byStaff[order.assignedTo].totalTime += duration;
        byStaff[order.assignedTo].count += 1;
      }

      // Agrupar por producto
      if (order.items) {
        order.items.forEach(item => {
          if (!byProduct[item.productId]) {
            byProduct[item.productId] = { 
              name: item.productName,
              totalTime: 0, 
              count: 0 
            };
          }
          byProduct[item.productId].totalTime += duration;
          byProduct[item.productId].count += item.quantity;
        });
      }
    });

    // Calcular promedios
    const avgCookingTime = totalTime / history.data.length;
    
    // Calcular promedios por personal
    Object.keys(byStaff).forEach(staffId => {
      byStaff[staffId].averageTime = byStaff[staffId].totalTime / byStaff[staffId].count;
    });

    // Calcular promedios por producto
    Object.keys(byProduct).forEach(productId => {
      byProduct[productId].averageTime = byProduct[productId].totalTime / byProduct[productId].count;
    });

    return {
      averageCookingTime: parseFloat(avgCookingTime.toFixed(2)),
      totalOrders: history.data.length,
      byStaff,
      byProduct: Object.values(byProduct).sort((a, b) => b.count - a.count)
    };
  }

  async getStaffEfficiency(dateFrom, dateTo) {
    const [staffData, history] = await Promise.all([
      this.getStaff(),
      this.getKdsHistory({
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString()
      })
    ]);

    if (!history.data || history.data.length === 0) {
      return [];
    }

    // Procesar datos de eficiencia
    const staffMap = new Map();
    
    // Inicializar mapa de personal
    staffData.data.forEach(staff => {
      staffMap.set(staff.id, {
        ...staff,
        totalOrders: 0,
        totalTime: 0,
        completedOrders: 0,
        rejectedOrders: 0,
        efficiencyScore: 0
      });
    });

    // Procesar historial
    history.data.forEach(order => {
      if (!order.assignedTo) return;
      
      const staff = staffMap.get(order.assignedTo);
      if (!staff) return;

      staff.totalOrders++;
      
      if (order.status === 'COMPLETED') {
        staff.completedOrders++;
        const startTime = new Date(order.startedAt || order.createdAt);
        const endTime = new Date(order.completedAt);
        staff.totalTime += (endTime - startTime) / 60000; // en minutos
      } else if (order.status === 'REJECTED' || order.status === 'CANCELLED') {
        staff.rejectedOrders++;
      }
    });

    // Calcular puntuación de eficiencia
    staffMap.forEach(staff => {
      if (staff.totalOrders > 0) {
        const completionRate = (staff.completedOrders / staff.totalOrders) * 100;
        const avgTime = staff.completedOrders > 0 
          ? staff.totalTime / staff.completedOrders 
          : 0;
        const rejectionRate = (staff.rejectedOrders / staff.totalOrders) * 100;
        
        // Fórmula de ejemplo para la puntuación de eficiencia
        // Ajustar según las necesidades del negocio
        staff.efficiencyScore = Math.max(0, Math.min(100, 
          (completionRate * 0.6) + 
          (Math.max(0, 100 - (avgTime * 2)) * 0.3) + // Penalizar tiempos altos
          (Math.max(0, 100 - (rejectionRate * 5)) * 0.1) // Penalizar rechazos
        ));
      }
    });

    return Array.from(staffMap.values())
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
  }
}
