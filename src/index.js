import http from 'http'; // [NEW] Importar http
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { envs } from './config/envs.js';
import morgan from 'morgan';
import scheduleDailyKpiJob from './workers/KpiDailyWorker.js';
import { startKpiWorker, shutdownKpiWorker } from './workers/KpiAlertWorker.js';
import kpiRoutes from './routes/main.route.js'; // [NEW] Importar Rutas
import { initSocket } from './utils/socket.util.js'; // [NEW] Importar Socket
import { initEventWorker } from './workers/event.worker.js'; // [NEW] Importar Worker Eventos
import startReportsWorker from './workers/reports.worker.js';
import { prisma } from './db/client.js'; // [NEW] Importar Prisma Client
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';

const app = express();

const corsOptions = {
  origin: 'https://interfaces-control.vercel.app', // Permitir todas las fuentes (ajustar según sea necesario)
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// --- 3. CONFIGURACIÓN WEBSOCKET (Tarea 3.6) ---
// En lugar de dejar que Express cree el servidor solo, lo creamos explícitamente con http
const server = http.createServer(app); 
// Inicializamos el socket pasando este servidor
initSocket(server); 
// ----------------------------------------------

// --- CONFIGURACIÓN WORKER REDIS (Tarea 4.5) ---
if (String(process.env.DISABLE_REDIS || '').toLowerCase() !== 'true') {
  // Inicializamos el consumidor de eventos (arranca a escuchar Redis)
  initEventWorker();
  // Iniciar worker de reportes (si procede)
  startReportsWorker().catch(err => console.warn('No se pudo iniciar reports.worker:', err));
} else {
  console.log('⚠️ Modo NO-REDIS activo: Workers de eventos y reportes desactivados.');
}
// ----------------------------------------------

// Middlewares globales
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(morgan('dev'));

// Rutas base
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'KPI-Backend', uptime: process.uptime() });
});

// Documentación Swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
console.log('[SWAGGER] Docs disponibles en /docs');

// Redirección de raíz a documentación
app.get('/', (req, res) => {
  res.redirect('/docs');
});


const PORT = envs?.PORT || process.env.PORT || 3000;

// Montar rutas de KPI
app.use('/api/v1/kpi', kpiRoutes);

// Iniciar servidor
// Se eliminó 'let server;' que causaba conflicto
(async function start() {
  try {
    // Programar el job repetido en BullMQ

    /*
    Comentado hasta que se tenga que desplegar

    await scheduleDailyKpiJob();
    console.log('[KPI] Job diario programado');
    await startKpiWorker();
    */
    

    // Iniciar servidor HTTP existente
    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} already in use. Please free the port or set PORT to a different value.`);
        process.exit(1);
      }
      console.error('Server error:', err);
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`> Local: http://localhost:${PORT}`);
    });
    // Start KPI poller automatically when in mock mode or when explicitly enabled
    try {
      if (String(process.env.START_KPI_POLLER || '').toLowerCase() === 'true' || envs.USE_MOCK_SERVICES) {
        const { startKpiPoller } = await import('./workers/kpiPoller.js');
        startKpiPoller({ intervalSec: Number(process.env.KPI_POLLER_INTERVAL_SEC || 60) });
      }
    } catch (e) {
      console.warn('Could not start KPI poller:', e.message || e);
    }
  } catch (err) {
    console.error('Fallo al iniciar la aplicación:', err);
    process.exit(1);
  }
})();

// Graceful Shutdown: Cerrar conexiones al detener el servidor
const gracefulShutdown = async () => {
  console.log('\nCerrando servidor y desconectando base de datos...');
  await prisma.$disconnect();
  //await shutdownKpiWorker();
  try {
    if (server && server.listening) {
      server.close(() => {
        console.log('Servidor cerrado correctamente.');
        process.exit(0);
      });
    } else {
      console.log('Servidor no estaba escuchando. Saliendo.');
      process.exit(0);
    }
  } catch (e) {
    console.error('Error cerrando servidor:', e);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);