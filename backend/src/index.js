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
  let connected = false;
  let uri = MONGO_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log('[MongoDB] Connected successfully to configured DATABASE_URL');
      connected = true;
    } catch (err) {
      console.warn('[MongoDB] Configured database connection failed:', err.message);
    }
  }

  if (!connected) {
    if (process.env.PILOT_TRIAL_MODE === 'true' || process.env.DRY_RUN_MODE === 'true') {
      console.error('FATAL: PILOT_TRIAL_MODE or DRY_RUN_MODE is active, but connection to persistent DATABASE_URL failed.');
      console.error('Refusing to start on ephemeral in-memory database (all research/pilot data would be lost on process exit).');
      process.exit(1);
    }

    try {
      console.log('[MongoDB] Starting automatic in-memory database for local testing...');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      await mongoose.connect(uri);
      app.set('isInMemoryDB', true);
      console.log('[MongoDB] In-memory MongoDB connected! All user registration, auth, and logs will persist for this session.');
      connected = true;
    } catch (memErr) {
      console.warn('[MongoDB] In-memory DB setup failed (proceeding without DB):', memErr.message);
    }
  }

  // Auto-seed default test user so credentials always work out of the box
  if (connected) {
    try {
      const { default: User } = await import('./models/User.js');
      const { default: Cycle } = await import('./models/Cycle.js');
      const existing = await User.findOne({ email: 'test@hercomfort.com' });
      if (!existing) {
        const user = new User({
          name: 'Elia Sharma',
          email: 'test@hercomfort.com',
          password: 'password123',
          isVerified: true,
          profileComplete: true,
          profile: {
            dateOfBirth: '2001-04-12',
            age: 25,
            weight: 56,
            height: 165,
            bloodGroup: 'B+',
          },
        });
        await user.save();

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 14);
        const cycle = new Cycle({
          user: user._id,
          startDate: startDate,
          endDate: new Date(startDate.getTime() + 5 * 24 * 60 * 60 * 1000),
          periodDuration: 5,
          cycleLength: 28,
          symptoms: ['cramps', 'fatigue'],
          flowLogs: [
            { date: startDate, level: 'medium' },
            { date: new Date(startDate.getTime() + 1 * 24 * 60 * 60 * 1000), level: 'heavy' },
            { date: new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000), level: 'medium' },
            { date: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000), level: 'light' },
            { date: new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000), level: 'light' },
          ],
        });
        await cycle.save();
        console.log('[Seed] Default test account ready: test@hercomfort.com / password123');
      }
    } catch (seedErr) {
      console.warn('[Seed Notice]', seedErr.message);
    }
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
