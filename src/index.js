import express from 'express';
import bodyParser from 'body-parser';
import { envs } from './config/envs.js';
import exampleRoutes from './routes/example/example.routes.js';
import morgan from 'morgan';
import scheduleDailyKpiJob from './workers/KpiDailyWorker.js';

const app = express();

// Middlewares globales
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(morgan('dev'));

// Rutas
app.get('/api', (req, res) => {
  res.json({ up: true });
});

const PORT = envs?.PORT || process.env.PORT || 3000;

// Montar rutas de KPI
import kpiRoutes from './routes/main.route.js';
app.use('/api/v1/kpi', kpiRoutes);

// Iniciar servidor
let server;
(async function start() {
  try {
    // Programar el job repetido en BullMQ
    await scheduleDailyKpiJob();
    console.log('[KPI] Job diario programado');

    // Iniciar servidor Express
    server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Fallo al iniciar la aplicación:', err);
    process.exit(1);
  }
})();

// Graceful Shutdown: Cerrar conexiones al detener el servidor
import { prisma } from './db/client.js';

const gracefulShutdown = async () => {
  console.log('\nCerrando servidor y desconectando base de datos...');
  await prisma.$disconnect();
  server.close(() => {
    console.log('Servidor cerrado correctamente.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
