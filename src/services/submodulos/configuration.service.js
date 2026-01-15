import { prisma } from '../../db/client.js';

export const updateGoal = async (id, data) => {
    const updated = await prisma.kpiMeta.update({
        where: { idMeta: Number(id) },
        data: {
            montoObjetivo: data.target_amount,
            fechaFin: data.end_date ? new Date(data.end_date) : undefined
        }
    });
    return { success: true, data: updated };
};

/**
 * Métricas permitidas (mantener consistencia con configuration.schema.js)
 */
const ALLOWED_METRICS = ['tiempo', 'rotacion', 'stock', 'ventas'];

/**
 * updateThreshold
 *
 * @param {string} metricKey - clave de la métrica (ej: 'tiempo', 'rotacion', 'stock', 'ventas')
 * @param {object} payload - objeto validado desde el controller: { value_warning, value_critical }
 *
 * @returns {Promise<object>} - registro insertado en kpi_threshold_history
 *
 * Lanza errores con la propiedad `status` para que el controller los mapee a respuestas HTTP.
 */
export async function updateThreshold(metricKey, payload, user=null) {
  // Normalizar metricKey
  const key = String(metricKey || '').trim().toLowerCase();

  // Validar metricKey básico
  if (!key) {
    const err = new Error('metric_key es requerido');
    err.status = 400;
    throw err;
  }

  if (!ALLOWED_METRICS.includes(key)) {
    const allowed = ALLOWED_METRICS.join(', ');
    const err = new Error(`metric_key inválido. Valores permitidos: ${allowed}`);
    err.status = 400;
    throw err;
  }

  // Validación defensiva mínima del payload (el controller ya aplica Zod)
  if (
    !payload ||
    typeof payload.value_warning !== 'number' ||
    typeof payload.value_critical !== 'number'
  ) {
    const err = new Error('Payload inválido: se requieren value_warning y value_critical numéricos');
    err.status = 400;
    throw err;
  }

  if (!(payload.value_warning < payload.value_critical)) {
    const err = new Error('Rango inválido: value_warning debe ser menor que value_critical');
    err.status = 400;
    throw err;
  }

  // Persistir en la tabla kpiThresholdsHistorial
  try {
    const created = await prisma.kpiThresholdsHistorial.create({
      data: {
        tipoMetrica: key, 
        valorAlerta: Math.trunc(payload.value_warning), 
        valorCritico: Math.trunc(payload.value_critical), 
        fechaCambio: new Date(),
        // user: null, // <-- Comentado: habilitar cuando el sistema de usuarios esté implementado
      },
    });

    return created;
  } catch (error) {
    const err = new Error('Error al guardar el historial de umbrales');
    err.cause = error;
    err.status = 500;
    throw err;
  }
}

export const currentRules = async (metricKey, data) => {
    // TODO: Actualizar umbral (Prisma o JSON Config)
    return { success: true };
};

export default {
  updateThreshold,
};