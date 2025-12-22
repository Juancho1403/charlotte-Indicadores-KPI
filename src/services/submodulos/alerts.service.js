import { prisma } from '../../db/client.js';

// Función auxiliar para convertir BigInt a String (para evitar errores al enviar el JSON)
const serializeAlert = (alert) => {
    return {
        ...alert,
        idAlerta: alert.idAlerta.toString(),
        idSnapshot: alert.idSnapshot ? alert.idSnapshot.toString() : null
    };
};

export const createAlert = async (data) => {
    // data viene del controlador: { metric, severity, message, store_id }

    const newAlert = await prisma.kpiAlertaHistorial.create({
        data: {
            // Mapeamos los campos del request a las columnas de tu tabla
            tipoIncidencia: data.metric,    // Debe coincidir con el enum KpiMetricType
            severidad: data.severity,       // Debe coincidir con el enum KpiSeverity
            itemAfectado: data.message,     // Guardamos el mensaje aquí
            // Si viene store_id lo guardamos como texto en valorRegistrado, si no, ponemos "MANUAL"
            valorRegistrado: data.store_id ? String(data.store_id) : "MANUAL",
            estadoGestion: 'PENDIENTE',
            timestampCreacion: new Date()
        }
    });

    return { 
        success: true, 
        id: newAlert.idAlerta.toString(), 
        data: serializeAlert(newAlert) 
    };
};

export const getHistory = async (filters) => {
    const { page = 1, limit = 10, severity, date_from, date_to, store_id } = filters;
    const skip = (page - 1) * limit;

    const where = {};

    // 1. Filtro de Fechas (usando timestampCreacion)
    if (date_from || date_to) {
        where.timestampCreacion = {};
        if (date_from) where.timestampCreacion.gte = new Date(date_from);
        if (date_to) where.timestampCreacion.lte = new Date(date_to);
    }

    // 2. Filtro de Severidad
    if (severity) {
        where.severidad = severity;
    }

    // 3. Filtro de Tienda (buscando en valorRegistrado)
    if (store_id) {
        where.valorRegistrado = String(store_id);
    }

    // Ejecutamos la consulta
    const [total, alerts] = await Promise.all([
        prisma.kpiAlertaHistorial.count({ where }),
        prisma.kpiAlertaHistorial.findMany({
            where,
            skip,
            take: limit,
            orderBy: { timestampCreacion: 'desc' }
        })
    ]);

    // Serializamos para manejar los BigInt
    const cleanAlerts = alerts.map(serializeAlert);

    return {
        success: true,
        data: cleanAlerts,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};