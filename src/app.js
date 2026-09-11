import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import passport from 'passport';

import readingsRouter from './modules/readings/readings.routes.js';
import authRouter     from './modules/auth/auth.routes.js';
import cycleRouter    from './modules/cycle/cycle.routes.js';
import wellnessRouter from './modules/wellness/wellness.routes.js';

import { createFreshTransporter } from './config/mail.config.js';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Passport (stateless — no sessions needed for JWT flow)
app.use(passport.initialize());

createFreshTransporter().then(t => t.verify()).then(() => {
  console.log("📍 [MAILER] Mailer is ready to send emails");
}).catch((err) => {
  console.error("❗ [MAILER] Mailer verification failed:", err);
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/readings', readingsRouter);
app.use('/api/auth',     authRouter);
app.use('/api/cycle',    cycleRouter);
app.use('/api/wellness', wellnessRouter);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

export default app;
