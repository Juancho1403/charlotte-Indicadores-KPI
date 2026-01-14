import express from 'express';
import bodyParser from 'body-parser';
<<<<<<< HEAD
import { envs } from './config/envs.js';
import morgan from 'morgan';
import scheduleDailyKpiJob from './workers/KpiDailyWorker.js';
import { startKpiWorker, shutdownKpiWorker } from './workers/KpiAlertWorker.js';
=======
import morgan from 'morgan';
import http from 'http'; // 1. Necesario para crear el servidor compatible con Socket.io
import { envs } from './config/envs.js';
import { prisma } from './db/client.js'; // Mejor importar esto arriba
import { initSocket } from './utils/socket.util.js'; // 2. Importamos tu nueva utilidad (nombre correcto)
import { initEventWorker } from './workers/event.worker.js';
// Rutas
import exampleRoutes from './routes/example/example.routes.js';
import kpiRoutes from './routes/main.route.js';
>>>>>>> origin/Angel

const app = express();

// --- 3. CONFIGURACIÓN WEBSOCKET (Tarea 3.6) ---
// En lugar de dejar que Express cree el servidor solo, lo creamos explícitamente con http
const server = http.createServer(app); 
// Inicializamos el socket pasando este servidor
initSocket(server); 
// ----------------------------------------------

// --- CONFIGURACIÓN WORKER REDIS (Tarea 4.5) ---
// Inicializamos el consumidor de eventos (arranca a escuchar Redis)
initEventWorker();
// ----------------------------------------------

// Middlewares globales
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(morgan('dev'));

// Rutas base
app.get('/api', (req, res) => {
  res.json({ up: true });
});

const PORT = envs?.PORT || process.env.PORT || 3000;

// Montar rutas de KPI
app.use('/api/v1/kpi', kpiRoutes);

<<<<<<< HEAD
// Iniciar servidor
let server;
(async function start() {
  try {
    // Programar el job repetido en BullMQ

    /*
    Comentado hasta que se tenga que desplegar

    await scheduleDailyKpiJob();
    console.log('[KPI] Job diario programado');
    await startKpiWorker();
    */
    

    // Iniciar servidor Express
    server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Fallo al iniciar la aplicación:', err);
    process.exit(1);
  }
})();
=======
// 4. Iniciar servidor
// OJO: Usamos 'server.listen' en vez de 'app.listen' para que funcionen los websockets
server.listen(envs.PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${envs.PORT} (WebSocket Activo)`)
);
>>>>>>> origin/Angel

// Graceful Shutdown: Cerrar conexiones al detener el servidor
const gracefulShutdown = async () => {
  console.log('\nCerrando servidor y desconectando base de datos...');
  await prisma.$disconnect();
  //await shutdownKpiWorker();
  server.close(() => {
    console.log('Servidor cerrado correctamente.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);