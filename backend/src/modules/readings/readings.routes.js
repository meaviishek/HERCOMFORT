import express from 'express';
import {
  createReading,
  createBatchReadings,
  createSession,
  getSessions,
  getReadings,
  getLatestReading,
  getStats,
} from './readings.controller.js';
import authGuard from '../auth/auth.guard.js'; // Fix 5

const router = express.Router();

// POST   /api/readings/batch    — store continuous readings batch with timestamps
// Fix 5: authGuard — unauthenticated batch writes were open to anyone
router.post('/batch', authGuard, createBatchReadings);

// POST   /api/readings/sessions — store completed therapy session record
// Fix 5: authGuard — session write must be owned by a logged-in user
router.post('/sessions', authGuard, createSession);

// GET    /api/readings/sessions — paginated list of therapy sessions (private)
// Fix 5: authGuard — list must be scoped to the requesting user
router.get('/sessions', authGuard, getSessions);

// POST   /api/readings          — store single reading
router.post('/', authGuard, createReading);

// GET    /api/readings/latest   — most recent reading (optional ?deviceId=)
// NOTE: kept open for firmware polling; review if multi-tenant
router.get('/latest', getLatestReading);

// GET    /api/readings/stats    — aggregated stats (?deviceId=&hours=24)
// NOTE: kept open for dashboard widgets; review if needed private
router.get('/stats', getStats);

// GET    /api/readings          — paginated list (?deviceId=&page=1&limit=50)
router.get('/', authGuard, getReadings);

export default router;


