import { BaseHttpService } from './http/BaseHttpService.js';
import { API_ENDPOINTS } from '../config/apiEndpoints.js';

export class AtencionClienteService extends BaseHttpService {
  constructor() {
    super('AtencionCliente', API_ENDPOINTS.ATC.BASE_URL);
  }

  // Mesas
  async getMesas(params = {}) {
    return this.get(API_ENDPOINTS.ATC.ENDPOINTS.MESAS, params);
  }

  async getMesaById(id) {
    return this.get(`${API_ENDPOINTS.ATC.ENDPOINTS.MESAS}/${id}`);
  }

  // Clientes
  async getClientes(params = {}) {
    return this.get(API_ENDPOINTS.ATC.ENDPOINTS.CLIENTES, params);
  }

  async getClienteById(id) {
    return this.get(`${API_ENDPOINTS.ATC.ENDPOINTS.CLIENTES}/${id}`);
  }

  // Service Requests
  async getServiceRequests(params = {}) {
    return this.get(API_ENDPOINTS.ATC.ENDPOINTS.SERVICE_REQUESTS, params);
  }

  async getServiceRequestById(id) {
    return this.get(`${API_ENDPOINTS.ATC.ENDPOINTS.SERVICE_REQUESTS}/${id}`);
  }

  // Métodos específicos para métricas

  /**
   * Calcula métricas de ocupación basadas en las mesas activas.
   */
  async getOccupancyMetrics() {
    // Obtener todas las mesas
    const mesasResponse = await this.getMesas();
    const mesas = mesasResponse.data || [];
    
    // Contar mesas ocupadas
    const totalMesas = mesas.length;
    // Asumiendo que la respuesta de mesas tiene un estado o flag de ocupación. 
    // Si no tenemos el esquema exacto, intentamos inferir por "status" o similar.
    // Según doc usuario: GET /api/v1/atencion-cliente/tables -> Obtener todas las mesas
    const mesasOcupadas = mesas.filter(m => m.status === 'OCCUPIED' || m.estado === 'OCUPADA').length; // Ajustar según respuesta real
    
    return {
      totalMesas,
      mesasOcupadas,
      porcentajeOcupacion: totalMesas > 0 ? (mesasOcupadas / totalMesas) * 100 : 0
    };
  }

  /**
   * Calcula tiempos de respuesta basados en Service Requests (solicitudes de servicio).
   * @param {Date} dateFrom 
   * @param {Date} dateTo 
   */
  async getServiceResponseMetrics(dateFrom, dateTo) {
    // Obtener solicitudes
    const requestsResponse = await this.getServiceRequests({
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString()
    });
    
    const requests = requestsResponse.data || [];
    
    if (requests.length === 0) {
      return { averageWaitTime: 0, totalRequests: 0 };
    }

    // Calcular tiempo promedio entre creación y atención/cierre
    let totalWaitTime = 0;
    let validCount = 0;

    requests.forEach(req => {
      // Asumiendo campos createdAt y resolvedAt/updatedAt
      const start = new Date(req.createdAt);
      // Si tiene fecha de resolución, la usamos. Si no, y está cerrada, usamos updatedAt?
      // Por seguridad, solo calculamos para las que tienen fecha de fin explicita o estado completado
      if (req.resolvedAt || (req.status === 'COMPLETED' && req.updatedAt)) {
        const end = new Date(req.resolvedAt || req.updatedAt);
        totalWaitTime += (end - start);
        validCount++;
      }
    });

    return {
      averageWaitTime: validCount > 0 ? (totalWaitTime / validCount) / 60000 : 0, // minutos
      totalRequests: requests.length,
      resolvedRequests: validCount
    };
  }
}
