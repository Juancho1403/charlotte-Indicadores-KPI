import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import http from 'http'; // 1. Necesario para crear el servidor compatible con Socket.io
import { envs } from './config/envs.js';
import { prisma } from './db/client.js'; // Mejor importar esto arriba
import { initSocket } from './utils/socket.util.js'; // 2. Importamos tu nueva utilidad (nombre correcto)

// Rutas
import exampleRoutes from './routes/example/example.routes.js';
import kpiRoutes from './routes/main.route.js';

const app = express();

// --- 3. CONFIGURACIÓN WEBSOCKET (Tarea 3.6) ---
// En lugar de dejar que Express cree el servidor solo, lo creamos explícitamente con http
const server = http.createServer(app); 
// Inicializamos el socket pasando este servidor
initSocket(server); 
// ----------------------------------------------

// Middlewares globales
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(morgan('dev'));

// Rutas base
app.get('/api', (req, res) => {
  res.json({ up: true });
});

// Montar rutas de KPI
app.use('/api/v1/kpi', kpiRoutes);

// 4. Iniciar servidor
// OJO: Usamos 'server.listen' en vez de 'app.listen' para que funcionen los websockets
server.listen(envs.PORT, () =>
  console.log(`🚀 Server ready at: http://localhost:${envs.PORT} (WebSocket Activo)`)
);

// Graceful Shutdown: Cerrar conexiones al detener el servidor
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