import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { envs } from './envs.js';

// Si quieres desactivar Redis sin tocar .env, exporta DISABLE_REDIS=true en tu entorno.
const DISABLE_REDIS = String(process.env.DISABLE_REDIS || '').toLowerCase() === 'true';

//  Opciones defecto para los trabajos
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: true
};

let _connection = null;
let _realQueue = null;
let _initializing = false;

function makeStubQueue(name = 'stub-queue') {
  return {
    async add(jobName, data, opts) {
      console.warn(`[StubQueue] Redis deshabilitado: encolado simulado para job=${jobName}`);
      return { id: `stub-${Date.now()}`, name: jobName, data };
    },
    async getJob(id) { return null; },
    async close() { return; },
  };
}

async function initRealQueue() {
  if (_realQueue || DISABLE_REDIS) return;
  if (_initializing) return; // prevent concurrent inits
  _initializing = true;

  try {
    _connection = new Redis({
      host: envs.REDIS_HOST,
      port: envs.REDIS_PORT,
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });

    _connection.on('error', (err) => {
      console.error('❌ Error conexión Redis:', err);
      if (err && (err.code === 'ECONNREFUSED' || (err.errors && err.errors.some(e => e.code === 'ECONNREFUSED')))) {
        console.warn('\n⚠️  SUGERENCIA: Redis no parece estar ejecutándose.');
        console.warn('   - Si NO deseas usar Redis, ejecuta: npm run dev:noredis');
        console.warn('   - O define DISABLE_REDIS=true en tu archivo .env\n');
      }
    });

    _realQueue = new Queue('reports-queue', { connection: _connection, defaultJobOptions });
  } catch (err) {
    console.warn('⚠️ No se pudo inicializar Redis para queues, usando StubQueue:', err && err.message ? err.message : err);
    _connection = null;
    _realQueue = makeStubQueue('reports-queue');
  } finally {
    _initializing = false;
  }
}

// Proxy that lazily initializes real queue on first method call
const reportQueue = {
  async add(...args) {
    if (DISABLE_REDIS) return makeStubQueue().add(...args);
    await initRealQueue();
    return _realQueue.add(...args);
  },
  async getJob(...args) {
    if (DISABLE_REDIS) return null;
    await initRealQueue();
    return _realQueue.getJob(...args);
  },
  async close(...args) {
    if (DISABLE_REDIS) return;
    await initRealQueue();
    return _realQueue.close(...args);
  },
  // expose internal state for diagnostics
  _getInternal() { return { connection: _connection, realQueue: _realQueue, disabled: DISABLE_REDIS }; }
};

export { reportQueue, _connection as connection };