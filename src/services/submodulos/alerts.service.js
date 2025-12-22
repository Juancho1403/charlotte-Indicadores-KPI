import { prisma } from '../../db/client.js';
// 1. NUEVO: Importamos el socket del archivo correcto (respetando convención .util.js)
import { getIO } from '../../utils/socket.util.js';

// Función auxiliar para convertir BigInt a String (MANTENIDO)
const serializeAlert = (alert) => {
    return {
        ...alert,
        idAlerta: alert.idAlerta.toString(),
        idSnapshot: alert.idSnapshot ? alert.idSnapshot.toString() : null
    };
};

export const createAlert = async (data) => {
    // data viene del controlador: { metric, severity, message, store_id }

    // 2. LOGICA DB 
    const newAlert = await prisma.kpiAlertaHistorial.create({
        data: {
            tipoIncidencia: data.metric,    // Debe coincidir con el enum KpiMetricType
            severidad: data.severity,       // Debe coincidir con el enum KpiSeverity
            itemAfectado: data.message,     // Guardamos el mensaje aquí
            valorRegistrado: data.store_id ? String(data.store_id) : "MANUAL",
            estadoGestion: 'PENDIENTE',
            timestampCreacion: new Date()
        }
    });

    // Serializamos la alerta recién creada
    const formattedAlert = serializeAlert(newAlert);

    // 3. NUEVO: Notificar por WebSocket (Tarea 3.6)
    try {
        const io = getIO();
        io.emit('notification', {
            type: 'NEW_ALERT',
            message: `Nueva alerta generada: ${data.metric}`,
            payload: formattedAlert
        });
    } catch (error) {
        // Usamos warn para que si el socket falla, la API siga funcionando y responda bien
        console.warn("⚠️ Advertencia: No se pudo enviar notificación WS", error.message);
    }

    // 4. RETORNO 
    return { 
        success: true, 
        id: newAlert.idAlerta.toString(), 
        data: formattedAlert 
    };
};

// 5. GET HISTORY 
export const getHistory = async (filters) => {
    const { page = 1, limit = 10, severity, date_from, date_to, store_id } = filters;
    const skip = (page - 1) * limit;

    const where = {};

    if (date_from || date_to) {
        where.timestampCreacion = {};
        if (date_from) where.timestampCreacion.gte = new Date(date_from);
        if (date_to) where.timestampCreacion.lte = new Date(date_to);
    }

    if (severity) {
        where.severidad = severity;
    }

    if (store_id) {
        where.valorRegistrado = String(store_id);
    }

    const [total, alerts] = await Promise.all([
        prisma.kpiAlertaHistorial.count({ where }),
        prisma.kpiAlertaHistorial.findMany({
            where,
            skip,
            take: limit,
            orderBy: { timestampCreacion: 'desc' }
        })
    ]);

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