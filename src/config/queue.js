import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { envs } from './envs.js'; // Importo la configuración que acabo de actualizar

//  Configuración de conexión (con reintentos)
const connection = new Redis({
  host: envs.REDIS_HOST,
  port: envs.REDIS_PORT,
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 50, 2000) // Si falla, espera un poco
});

connection.on('error', (err) => console.error('❌ Error conexión Redis:', err));

//  Opciones defecto para los trabajos
const defaultJobOptions = {
  attempts: 3,             // Reintentar 3 veces si falla
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true
};

//  Exporta la cola para que la usen el Servicio y el Worker
export const reportQueue = new Queue('reports-queue', { connection, defaultJobOptions });
export { connection };