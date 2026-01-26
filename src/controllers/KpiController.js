import { KpiService } from '../services/KpiService.js';
import { validationResult } from 'express-validator';

export class KpiController {
  constructor() {
    this.kpiService = new KpiService();
  }

  /**
   * Obtiene el resumen ejecutivo
   */
  obtenerResumenEjecutivo = async (req, res) => {
    try {
      // Validar parámetros de entrada
      const errores = validationResult(req);
      if (!errores.isEmpty()) {
        return res.status(400).json({
          exito: false,
          errores: errores.array()
        });
      }

      const { fechaInicio, fechaFin, idTienda } = req.query;
      
      // Convertir fechas a objetos Date
      const fechaInicioObj = fechaInicio ? new Date(fechaInicio) : new Date();
      const fechaFinObj = fechaFin ? new Date(fechaFin) : new Date();

      // Validar fechas
      if (isNaN(fechaInicioObj) || isNaN(fechaFinObj)) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }

      // Ajustar la fecha fin para incluir todo el día
      fechaFinObj.setHours(23, 59, 59, 999);

      // Obtener datos del servicio
      const resultado = await this.kpiService.obtenerResumenEjecutivo(
        fechaInicioObj,
        fechaFinObj,
        idTienda
      );

      res.json(resultado);

    } catch (error) {
      console.error('Error en obtenerResumenEjecutivo:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener el resumen ejecutivo',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Obtiene métricas de rendimiento del personal
   */
  obtenerMetricasPersonal = async (req, res) => {
    try {
      const { fechaInicio, fechaFin, idTienda } = req.query;
      
      // Validar fechas
      const fechaInicioObj = fechaInicio ? new Date(fechaInicio) : new Date();
      const fechaFinObj = fechaFin ? new Date(fechaFin) : new Date();
      
      if (isNaN(fechaInicioObj) || isNaN(fechaFinObj)) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
      }

      // Ajustar la fecha fin para incluir todo el día
      fechaFinObj.setHours(23, 59, 59, 999);

      // Obtener métricas de rendimiento del personal
      const metricasPersonal = await this.kpiService.obtenerMetricasPersonal(
        fechaInicioObj,
        fechaFinObj,
        idTienda
      );

      res.json({
        exito: true,
        datos: metricasPersonal,
        fechaInicio: fechaInicioObj.toISOString(),
        fechaFin: fechaFinObj.toISOString(),
        idTienda: idTienda || 'todas'
      });

    } catch (error) {
      console.error('Error en obtenerMetricasPersonal:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener métricas del personal',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Obtiene alertas y notificaciones
   */
  obtenerAlertas = async (req, res) => {
    try {
      const { severidad, limite = 20, pagina = 1 } = req.query;
      
      // Validar parámetros
      const limiteNum = Math.min(parseInt(limite), 100);
      const paginaNum = Math.max(1, parseInt(pagina));
      
      // Obtener alertas del servicio
      const alertas = await this.kpiService.obtenerAlertas({
        severidad,
        limite: limiteNum,
        pagina: paginaNum
      });

      res.json({
        exito: true,
        datos: alertas,
        paginacion: {
          total: alertas.length,
          pagina: paginaNum,
          porPagina: limiteNum
        }
      });

    } catch (error) {
      console.error('Error en obtenerAlertas:', error);
      res.status(500).json({
        exito: false,
        mensaje: 'Error al obtener alertas',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Maneja errores no controlados
   */
  manejarError = (error, req, res, next) => {
    console.error('Error no controlado:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  };
}
