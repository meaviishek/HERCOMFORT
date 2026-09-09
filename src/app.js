const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const passport = require('passport');

const readingsRouter = require('./modules/readings/readings.routes');
const authRouter     = require('./modules/auth/auth.routes');
const cycleRouter    = require('./modules/cycle/cycle.routes');
const wellnessRouter = require('./modules/wellness/wellness.routes');

const { createFreshTransporter } = require('./config/mail.config');

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

module.exports = app;
