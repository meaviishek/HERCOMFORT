/**
 * Socket.io singleton
 * Initialized once in index.js and exported for use across controllers.
 */

import { Server } from 'socket.io';

let io = null;

/**
 * Initialize the Socket.io instance.
 * @param {import('http').Server} httpServer
 * @param {object} [opts] - Socket.io server options
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer, opts = {}) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    ...opts,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('subscribe-device', (deviceId) => {
      socket.join(`device:${deviceId}`);
      console.log(`[Socket.io] ${socket.id} subscribed to device:${deviceId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Return the existing Socket.io instance.
 * Throws if initSocket() was not called first.
 * @returns {import('socket.io').Server}
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket(httpServer) first.');
  }
  return io;
}
