import { prisma } from '../../db/client.js';

export const updateGoal = async (id, data) => {
    // TODO: Actualizar meta en DB
    return { success: true };
};

export const updateThreshold = async (metricKey, data) => {
    // TODO: Actualizar umbral (Prisma o JSON Config)
    return { success: true };
};

export const currentRules = async (metricKey, data) => {
    // TODO: Actualizar umbral (Prisma o JSON Config)
    return { success: true };
};