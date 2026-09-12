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

const router = express.Router();

// POST   /api/readings/batch    — store continuous readings batch with timestamps
router.post('/batch', createBatchReadings);

// POST   /api/readings/sessions — store completed therapy session record
router.post('/sessions', createSession);

// GET    /api/readings/sessions — paginated list of therapy sessions
router.get('/sessions', getSessions);

// POST   /api/readings          — store single reading
router.post('/', createReading);

// GET    /api/readings/latest   — most recent reading (optional ?deviceId=)
router.get('/latest', getLatestReading);

// GET    /api/readings/stats    — aggregated stats (?deviceId=&hours=24)
router.get('/stats', getStats);

// GET    /api/readings          — paginated list (?deviceId=&page=1&limit=50)
router.get('/', getReadings);

export default router;

