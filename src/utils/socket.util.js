/**
 * @format
 * Utilidad para manejar la conexión WebSocket (Socket.io).
 * Permite inicializar y obtener la instancia del socket en toda la app.
 */

import { Server } from 'socket.io';

let io;

/**
 * Inicializa el servidor de WebSockets.
 * @param {object} httpServer - El servidor HTTP de Node/Express.
 * @returns {Server} La instancia de Socket.io.
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado al WebSocket ID:', socket.id);
  });

  return io;
};

/**
 * Obtiene la instancia activa de Socket.io.
 * @returns {Server}
 * @throws {Error} Si no se ha inicializado el socket.
 */
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io no ha sido inicializado todavía.");
  }
  return io;
};