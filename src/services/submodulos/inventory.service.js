import { prisma } from '../../db/client.js';
import { connection as redisClient } from '../../config/queue.js'; // Importamos tu conexión Redis existente

export const getPareto = async (forceRefresh = false) => {
    const CACHE_KEY = 'kpi:inventory:pareto';

    // --- TAREA 2.5: Cache (Redis) ---
    // Si no fuerzan el refresco, intentamos leer de Redis
    if (!forceRefresh) {
        const cachedData = await redisClient.get(CACHE_KEY);
        if (cachedData) {
            console.log('⚡ Cache Hit: Inventory Pareto');
            // Devolvemos directamente, parseando el string a JSON
            return JSON.parse(cachedData);
        }
    }

    console.log('🐢 Cache Miss: Calculando Pareto en BD...');

    // --- TAREA 2.4: Lógica de Negocio (Prisma) ---
    
    // 1. Agregación: Agrupar por producto y sumar totales
    // Nota: Asumo que la tabla dp_note_items existe en el DB
    const rawData = await prisma.dp_note_items.groupBy({
        by: ['product_id'],
        _sum: {
            total: true,    // Valor monetario
            quantity: true  // Cantidad vendida
        }
    });

    //  Procesamiento y Normalización
    let processedData = rawData.map(item => {
        const normalizedName = `PRODUCT-${item.product_id}`; // Placeholder de nombre

        return {
            product_id: item.product_id,
            name: normalizedName,
            value: Number(item._sum.total || 0),   // Asegurar numérico
            quantity: Number(item._sum.quantity || 0),
            is_champion: false // Por defecto false
        };
    });

    //  Ordenar (Mayor a menor valor)
    processedData.sort((a, b) => b.value - a.value);

    //  Marcar al "Champion" (El #1)
    if (processedData.length > 0) {
        processedData[0].is_champion = true;
    }

    // --- Guardar en Redis (TTL 1 hora) ---
    await redisClient.set(CACHE_KEY, JSON.stringify(processedData), 'EX', 3600);

    return processedData;
};

// --- OTRAS FUNCIONES (Se mantienen igual por ahora) ---

export const getAlerts = async (filters) => {
    // TODO: Implementar alertas de stock (Tarea futura)
    return { critical_count: 0, alerts: [] };
};

export const getItemDetails = async (itemId) => {
    // TODO: Implementar detalle de item (Tarea futura)
    return { success: true, data: {} };
};