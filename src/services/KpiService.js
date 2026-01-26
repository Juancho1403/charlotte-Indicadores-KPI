import { AtencionClienteService } from './AtencionClienteService.js';
import { KitchenService } from './KitchenService.js';
import { DeliveryService } from './DeliveryService.js';
import { PrismaClient } from '@prisma/client';
import { CACHE_TTL } from '../config/apiEndpoints.js';

export class KpiService {
  constructor() {
    this.atcService = new AtencionClienteService();
    this.kitchenService = new KitchenService();
    this.deliveryService = new DeliveryService();
    this.prisma = new PrismaClient();
    this.cache = new Map();
  }

  /**
   * Obtiene el resumen ejecutivo del dashboard
   * @param {Date} fechaInicio - Fecha de inicio
   * @param {Date} fechaFin - Fecha de fin
   * @param {string} idTienda - ID de la tienda (opcional)
   * @returns {Promise<Object>} Resumen ejecutivo
   */
  async obtenerResumenEjecutivo(fechaInicio, fechaFin, idTienda = null) {
    const cacheKey = `resumen_ejecutivo_${fechaInicio}_${fechaFin}_${idTienda || 'todos'}`;
    const cacheado = this.obtenerDeCache(cacheKey);
    if (cacheado) return cacheado;

    try {
      // Obtener datos en paralelo
      const [datosIngresos, datosOperaciones, metricasCocina] = await Promise.all([
        this.obtenerMetricasIngresos(fechaInicio, fechaFin, idTienda),
        this.obtenerMetricasOperativas(fechaInicio, fechaFin, idTienda),
        this.kitchenService.getCookingTimeMetrics(fechaInicio, fechaFin)
      ]);

      // Obtener metas financieras
      const metaFinanciera = await this.obtenerMetaFinanciera(fechaInicio, fechaFin, idTienda);

      const resultado = {
        exito: true,
        timestamp: new Date().toISOString(),
        datos: {
          ingresos: {
            total: datosIngresos.ingresosTotales,
            moneda: datosIngresos.moneda || 'USD',
            porcentaje_tendencia: datosIngresos.porcentajeTendencia || 0,
            direccion_tendencia: datosIngresos.direccionTendencia || 'ESTABLE'
          },
          meta_trimestral: {
            objetivo: metaFinanciera.montoObjetivo,
            actual: metaFinanciera.montoActual,
            porcentaje_progreso: metaFinanciera.porcentajeProgreso,
            estado_ui: metaFinanciera.estado
          },
          operaciones: {
            tiempo_promedio_servicio: this.formatearTiempo(datosOperaciones.tiempoPromedioServicio),
            estado_tiempo: this.obtenerEstadoTiempo(datosOperaciones.tiempoPromedioServicio, 'TIEMPO_SERVICIO'),
            rotacion_mesas: datosOperaciones.rotacionMesas,
            estado_rotacion: this.obtenerEstadoRotacionMesas(datosOperaciones.rotacionMesas)
          },
          cocina: {
            tiempo_promedio_cocina: this.formatearTiempo(metricasCocina.averageCookingTime),
            eficiencia: this.calcularEficienciaCocina(metricasCocina)
          }
        }
      };

      this.guardarEnCache(cacheKey, resultado, CACHE_TTL.MEDIO);
      return resultado;

    } catch (error) {
      console.error('Error en obtenerResumenEjecutivo:', error);
      throw new Error('Error al generar el resumen ejecutivo');
    }
  }

  /**
   * Obtiene métricas de ingresos
   * @private
   */
  async obtenerMetricasIngresos(fechaInicio, fechaFin, idTienda) {
    // Obtener datos de órdenes de delivery
    const datosDelivery = await this.deliveryService.getDeliveryMetrics(fechaInicio, fechaFin);
    
    // Obtener comandas cerradas del módulo de atención al cliente
    const comandas = await this.atcService.getComandas({
      estado: 'CERRADA',
      fechaDesde: fechaInicio.toISOString(),
      fechaHasta: fechaFin.toISOString(),
      idTienda
    });

    // Calcular ingresos totales
    let ingresosTotales = datosDelivery.ingresosTotales || 0;
    let ingresosComandas = 0;

    if (comandas.datos && comandas.datos.length > 0) {
      ingresosComandas = comandas.datos.reduce((suma, comanda) => {
        return suma + (parseFloat(comanda.total) || 0);
      }, 0);
      ingresosTotales += ingresosComandas;
    }

    // Calcular tendencia (simplificado - en producción comparar con período anterior)
    const datosTendencia = await this.calcularTendenciaIngresos(fechaInicio, fechaFin, idTienda);

    return {
      ingresosTotales: parseFloat(ingresosTotales.toFixed(2)),
      moneda: 'USD',
      porcentajeTendencia: datosTendencia.porcentaje,
      direccionTendencia: datosTendencia.direccion,
      ingresosComandas: parseFloat(ingresosComandas.toFixed(2)),
      ingresosDelivery: datosDelivery.ingresosTotales || 0
    };
  }

  /**
   * Obtiene métricas operativas
   * @private
   */
  async obtenerMetricasOperativas(fechaInicio, fechaFin, idTienda) {
    // Obtener tiempo promedio de servicio
    const datosTiempoServicio = await this.atcService.getAverageServiceTime(fechaInicio, fechaFin);
    
    // Obtener rotación de mesas
    const datosRotacion = await this.calcularRotacionMesas(fechaInicio, fechaFin, idTienda);

    return {
      tiempoPromedioServicio: datosTiempoServicio.promedio,
      rotacionMesas: datosRotacion.tasaRotacion,
      totalMesas: datosRotacion.totalMesas,
      mesasActivas: datosRotacion.mesasActivas
    };
  }

  /**
   * Calcula la rotación de mesas
   * @private
   */
  async calcularRotacionMesas(fechaInicio, fechaFin, idTienda) {
    // Obtener todas las mesas
    const mesas = await this.atcService.getMesas({ idTienda });
    const totalMesas = mesas.datos?.length || 0;
    
    if (totalMesas === 0) {
      return { tasaRotacion: 0, totalMesas: 0, mesasActivas: 0 };
    }

    // Obtener sesiones activas en el rango de fechas
    const sesiones = await this.atcService.getActiveSessions();
    const mesasActivas = sesiones.length;

    // Calcular horas de operación (simplificado)
    const diferenciaHoras = (fechaFin - fechaInicio) / (1000 * 60 * 60); // diferencia en horas
    const horasOperacion = Math.min(24, Math.max(1, diferenciaHoras)); // asegurar entre 1 y 24 horas

    // Calcular rotación (promedio de clientes por mesa por hora)
    const tasaRotacion = mesasActivas > 0 
      ? parseFloat((sesiones.length / mesasActivas / horasOperacion).toFixed(2))
      : 0;

    return {
      tasaRotacion,
      totalMesas,
      mesasActivas,
      horasOperacion
    };
  }

  /**
   * Obtiene la meta financiera actual
   * @private
   */
  async obtenerMetaFinanciera(fechaInicio, fechaFin, idTienda) {
    try {
      const ahora = new Date();
      const trimestreActual = Math.floor(ahora.getMonth() / 3) + 1;
      const año = ahora.getFullYear();
      
      // Buscar meta para el trimestre actual
      const meta = await this.prisma.kpiMeta.findFirst({
        where: {
          fechaInicio: {
            lte: ahora
          },
          fechaFin: {
            gte: ahora
          },
          activa: true,
          // Aquí podrías filtrar por idTienda si es necesario
        }
      });

      if (!meta) {
        return {
          montoObjetivo: 0,
          montoActual: 0,
          porcentajeProgreso: 0,
          estado: 'NO_DEFINIDO'
        };
      }

      // Obtener ingresos acumulados en el período de la meta
      const datosIngresos = await this.obtenerMetricasIngresos(
        meta.fechaInicio,
        ahora,
        idTienda
      );

      const porcentajeProgreso = meta.montoObjetivo > 0
        ? Math.min(100, (datosIngresos.ingresosTotales / meta.montoObjetivo) * 100)
        : 0;

      // Determinar estado según el progreso
      let estado = 'EN_CURSO';
      const diasTranscurridos = (ahora - meta.fechaInicio) / (1000 * 60 * 60 * 24);
      const totalDias = (meta.fechaFin - meta.fechaInicio) / (1000 * 60 * 60 * 24);
      const progresoEsperado = (diasTranscurridos / totalDias) * 100;

      if (porcentajeProgreso < progresoEsperado * 0.7) {
        estado = 'EN_RIESGO';
      } else if (porcentajeProgreso < progresoEsperado * 0.9) {
        estado = 'NECESITA_ATENCION';
      }

      return {
        montoObjetivo: parseFloat(meta.montoObjetivo),
        montoActual: datosIngresos.ingresosTotales,
        porcentajeProgreso: parseFloat(porcentajeProgreso.toFixed(2)),
        estado
      };

    } catch (error) {
      console.error('Error al obtener meta financiera:', error);
      return {
        montoObjetivo: 0,
        montoActual: 0,
        porcentajeProgreso: 0,
        estado: 'ERROR'
      };
    }
  }

  /**
   * Calcula la tendencia de ingresos comparando con el período anterior
   * @private
   */
  async calcularTendenciaIngresos(inicioActual, finActual, idTienda) {
    try {
      const duracionMs = finActual - inicioActual;
      const inicioAnterior = new Date(inicioActual.getTime() - duracionMs);
      const finAnterior = new Date(finActual.getTime() - duracionMs);

      const [periodoActual, periodoAnterior] = await Promise.all([
        this.obtenerMetricasIngresos(inicioActual, finActual, idTienda),
        this.obtenerMetricasIngresos(inicioAnterior, finAnterior, idTienda)
      ]);

      const ingresosActuales = periodoActual.ingresosTotales;
      const ingresosAnteriores = periodoAnterior.ingresosTotales;

      if (ingresosAnteriores === 0) {
        return {
          porcentaje: 100,
          direccion: 'SUBIENDO'
        };
      }

      const porcentaje = ((ingresosActuales - ingresosAnteriores) / ingresosAnteriores) * 100;
      
      return {
        porcentaje: Math.abs(parseFloat(porcentaje.toFixed(2))),
        direccion: porcentaje >= 0 ? 'SUBIENDO' : 'BAJANDO'
      };

    } catch (error) {
      console.error('Error al calcular tendencia de ingresos:', error);
      return {
        porcentaje: 0,
        direccion: 'ESTABLE'
      };
    }
  }

  // Métodos de utilidad
  formatearTiempo(minutos) {
    if (isNaN(minutos) || minutos === 0) return '00:00';
    const horas = Math.floor(minutos / 60);
    const mins = Math.floor(minutos % 60);
    return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  obtenerEstadoTiempo(minutos, tipoMetrica) {
    // Aquí podrías implementar la lógica para determinar el estado según los umbrales
    // Por ahora, devolvemos un valor por defecto
    if (minutos < 15) return 'OPTIMO';
    if (minutos < 30) return 'ADVERTENCIA';
    return 'CRITICO';
  }

  obtenerEstadoRotacionMesas(tasaRotacion) {
    // Lógica para determinar el estado de rotación de mesas
    if (tasaRotacion >= 1.5) return 'OPTIMO';
    if (tasaRotacion >= 0.8) return 'ADVERTENCIA';
    return 'CRITICO';
  }

  calcularEficienciaCocina(metricas) {
    // Lógica para calcular la eficiencia de cocina
    if (!metricas || !metricas.averageCookingTime) return 0;
    
    // Ejemplo simple: puntuación basada en el tiempo de cocina
    // Menor tiempo = mayor eficiencia (hasta 100)
    const tiempoMaximo = 60; // 60 minutos como máximo para una orden
    const eficiencia = Math.max(0, 100 - ((metricas.averageCookingTime / tiempoMaximo) * 100));
    return parseFloat(eficiencia.toFixed(2));
  }

  // Métodos de caché
  obtenerDeCache(clave) {
    const cacheado = this.cache.get(clave);
    if (!cacheado) return null;
    
    if (cacheado.fechaExpiracion < Date.now()) {
      this.cache.delete(clave);
      return null;
    }
    
    return cacheado.valor;
  }

  guardarEnCache(clave, valor, segundosTTL) {
    this.cache.set(clave, {
      valor,
      fechaExpiracion: Date.now() + (segundosTTL * 1000)
    });
  }

  // Cerrar conexión a la base de datos
  async desconectar() {
    await this.prisma.$desconectar();
  }
}
