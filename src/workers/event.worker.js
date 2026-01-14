import { Worker } from 'bullmq';
import { envs } from '../config/envs.js';

const connection = {
  host: envs.REDIS_HOST,
  port: envs.REDIS_PORT
};

/**
 * Tarea 4.5: Ingesta de Eventos.
 * Escucha la cola 'kpi_events' para patrones de comanda y pagos.
 */
export const initEventWorker = () => {
  const worker = new Worker('kpi_events', async (job) => {
    console.log(`📥 [Redis] Procesando evento: ${job.name}`);

    try {
      // 1. Patrón 'comanda.*'
      if (job.name.startsWith('comanda.')) {
        console.log(`🍔 Comanda actualizada. ID: ${job.data?.id || 'Desconocido'}`);
        // Aquí iría la lógica de DB para contadores
        return { processed: true, type: 'COMANDA_UPDATE' };
      }

      // 2. Evento específico 'note.paid'
      if (job.name === 'note.paid') {
        console.log(`💰 Pago registrado. Monto: ${job.data?.amount || 0}`);
        // Aquí iría la lógica de DB para ingresos
        return { processed: true, type: 'PAYMENT_RECEIVED' };
      }

    } catch (error) {
      console.error(`❌ Error en job ${job.id}:`, error);
    }
  }, { 
    connection,
    autorun: true 
  });

  worker.on('ready', () => {
    console.log('👷 Event Worker (Redis) está LISTO y escuchando.');
  });

  worker.on('error', (err) => {
    // Usamos warn para no detener el servidor si no hay Redis local
    console.warn('⚠️ Worker Error (Revisar conexión Redis):', err.code);
  });
};