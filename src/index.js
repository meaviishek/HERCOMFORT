import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import app from './app.js';
import { initSocket } from './config/socket.js';

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.DATABASE_URL;

// ─── Create HTTP server ───────────────────────────────────────────────────────
const server = http.createServer(app);

// ─── Attach Socket.io ─────────────────────────────────────────────────────────
const io = initSocket(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Attach io to app locals so routes can access if needed
app.set('io', io);

// ─── Connect to MongoDB ───────────────────────────────────────────────────────
async function startServer() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.warn('[MongoDB] Warning: Connection failed (proceeding without DB) -', err.message);
  }

  // Always start the server so Socket.io is available for broadcasting live streams
  server.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Socket.io] WebSocket server ready`);
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down gracefully...');
  await mongoose.disconnect();
  server.close(() => {
    console.log('[Server] Closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason);
});

startServer();

export default app;
