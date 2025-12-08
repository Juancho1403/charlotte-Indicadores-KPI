import express from 'express';
import bodyParser from 'body-parser';
import { envs } from './config/envs.js';
import exampleRoutes from './routes/example/example.routes.js';
import kpiRoutes from './routes/kpi/index.js';
import morgan from 'morgan';

const app = express();

// Middlewares globales
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(morgan('dev'));

// Rutas
app.get('/api', (req, res) => {
  res.json({ up: true });
});

// Montar rutas de ejemplo
app.use('/api/example', exampleRoutes);
app.use('/api/v1/kpi', kpiRoutes);

// Iniciar servidor
const server = app.listen(envs.PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${envs.PORT}`)
);

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


