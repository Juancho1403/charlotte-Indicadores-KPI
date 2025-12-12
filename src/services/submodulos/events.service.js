import { prisma } from '../../db/client.js';

export const ingestEvent = async (data) => {
    // TODO: Idempotencia y procesamiento de evento
    return { success: true, processed: true };
};
