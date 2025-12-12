import { prisma } from '../../db/client.js';

export const createAlert = async (data) => {
    // TODO: Insertar alerta en historial y notificar
    return { success: true, id: Date.now() };
};

export const getHistory = async (filters) => {
    // TODO: Consultar historial con paginación
    return { success: true, data: [], meta: {} };
};
