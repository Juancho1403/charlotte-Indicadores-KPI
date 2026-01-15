import { prisma } from '../../db/client.js';

export const ingestEvent = async (data) => {
    const { event, payload, event_id } = data;
    
    // Idempotencia: Verificar si event_id ya procesado (Opcional, requiere tabla de eventos procesados)
    // Por simplicidad, procesamos directo.
    
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

    if (event === 'comanda.created') {
        // Incremento pedidos
        await prisma.kpiSnapshotDiario.update({
            where: { idLog: snapshot.idLog },
            data: { totalPedidos: { increment: 1 } }
        });
    } else if (event === 'note.paid') {
        // Incremento ventas
        const amount = Number(payload.amount || 0);
        await prisma.kpiSnapshotDiario.update({
            where: { idLog: snapshot.idLog },
            data: { totalVentas: { increment: amount } }
        });
    }
    
    return { success: true, processed: true, event_id };
};
