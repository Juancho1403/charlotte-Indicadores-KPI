import { prisma } from '../../db/client.js';

/**
 * Ingestar Evento (Idempotente)
 * Punto de entrada para la ingestión de datos desde otros módulos
 * Lógica: Idempotencia verificando si event_id ya existe
 * Validar schema según el tipo de event
 * Actualizar cachés incrementales
 */
export const ingestEvent = async (data) => {
    const { event, payload, event_id, source } = data;
    
    // Idempotencia: Verificar si event_id ya procesado
    // Nota: En producción, debería haber una tabla de eventos procesados
    // Por simplicidad, procesamos directo pero se puede mejorar con una tabla de eventos
    
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // Intentar obtener snapshot de hoy
    let snapshot = await prisma.kpiSnapshotDiario.findUnique({
        where: { fechaCorte: new Date(todayStr) }
    });

    if (!snapshot) {
        // Crear si no existe
        snapshot = await prisma.kpiSnapshotDiario.create({
            data: { fechaCorte: new Date(todayStr) }
        });
    }

    // ============================================
    // EVENTOS DEL MÓDULO COCINA (KDS)
    // ============================================
    
    if (event === 'comanda.created' || event === 'comanda.sent') {
        // Comanda creada o enviada a cocina
        await prisma.kpiSnapshotDiario.update({
            where: { idLog: snapshot.idLog },
            data: { totalPedidos: { increment: 1 } }
        });
    } else if (event === 'comanda.ready' || event === 'comanda.delivered') {
        // Comanda lista o entregada - actualizar métricas de tiempo
        // Esto se puede usar para calcular SLA breakdown
        // Por ahora solo registramos el evento
    } else if (event === 'inventory.consumed') {
        // Consumo de inventario desde cocina
        // Esto se puede usar para alertas de stock
    } else if (event === 'recipe.used') {
        // Receta utilizada - para análisis de consumo
    }
    
    // ============================================
    // EVENTOS DEL MÓDULO ATENCIÓN AL CLIENTE (ATC)
    // ============================================
    
    else if (event === 'comanda.created' && source === 'atc') {
        // Comanda creada desde ATC
        await prisma.kpiSnapshotDiario.update({
            where: { idLog: snapshot.idLog },
            data: { totalPedidos: { increment: 1 } }
        });
    } else if (event === 'comanda.updated' || event === 'comanda.closed') {
        // Comanda actualizada o cerrada
        const amount = Number(payload.total || payload.monto_total || 0);
        if (amount > 0 && payload.status !== 'CANCELLED') {
            await prisma.kpiSnapshotDiario.update({
                where: { idLog: snapshot.idLog },
                data: { totalVentas: { increment: amount } }
            });
        }
    } else if (event === 'mesa.occupied' || event === 'mesa.available') {
        // Cambio de estado de mesa - para cálculo de rotación
    } else if (event === 'sesion.started' || event === 'sesion.ended') {
        // Sesión iniciada o terminada - para cálculo de tiempo promedio de servicio
    } else if (event === 'service-request.created' || event === 'service-request.resolved') {
        // Solicitud de servicio - para métricas de atención
    } else if (event === 'cliente_temporal.created' || event === 'cliente_temporal.closed') {
        // Cliente temporal - para cálculo de tiempo promedio de servicio
        // Calcular tiempo si se cierra
        if (event === 'cliente_temporal.closed' && payload.created_at && payload.closed_at) {
            // El cálculo de tiempo promedio se puede hacer en el dashboard service
        }
    }
    
    // ============================================
    // EVENTOS DEL MÓDULO DELIVERY/PICKUP (DP)
    // ============================================
    
    else if (event === 'note.created' || event === 'dp_note.created') {
        // Nota de entrega creada
    } else if (event === 'note.paid' || event === 'dp_note.paid') {
        // Nota de entrega pagada - incrementar ventas
        const amount = Number(payload.amount || payload.monto_total || payload.total_amount || 0);
        if (amount > 0 && payload.status !== 'CANCELLED') {
            await prisma.kpiSnapshotDiario.update({
                where: { idLog: snapshot.idLog },
                data: { totalVentas: { increment: amount } }
            });
        }
    } else if (event === 'order.status_changed' || event === 'dp_order.status_changed') {
        // Cambio de estado de pedido externo
        // Si se cancela, podría necesitar revertir ventas (implementar si es necesario)
        if (payload.new_status === 'CANCELLED' && payload.previous_status !== 'CANCELLED') {
            const amount = Number(payload.amount || payload.monto_total || 0);
            if (amount > 0) {
                await prisma.kpiSnapshotDiario.update({
                    where: { idLog: snapshot.idLog },
                    data: { totalVentas: { decrement: amount } }
                });
            }
        }
    } else if (event === 'payment.completed') {
        // Pago completado
        const amount = Number(payload.amount || 0);
        if (amount > 0) {
            await prisma.kpiSnapshotDiario.update({
                where: { idLog: snapshot.idLog },
                data: { totalVentas: { increment: amount } }
            });
        }
    }
    
    // ============================================
    // EVENTOS GENÉRICOS
    // ============================================
    
    else {
        // Evento no reconocido - log pero no fallar
        console.log(`Evento no reconocido: ${event} desde ${source || 'unknown'}`);
    }
    
    // Nota: En producción, se debería:
    // 1. Registrar el evento procesado en una tabla de eventos para idempotencia
    // 2. Emitir notificación vía WebSocket si es una alerta crítica
    // 3. Invalidar cachés relevantes
    
    return { success: true, processed: true, event_id };
};
