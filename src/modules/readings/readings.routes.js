import express from 'express';
import {
  createReading,
  getReadings,
  getLatestReading,
  getStats,
} from './readings.controller.js';

const router = express.Router();

// POST   /api/readings          — store new reading from mobile app
router.post('/', createReading);

// GET    /api/readings/latest   — most recent reading (optional ?deviceId=)
router.get('/latest', getLatestReading);

// GET    /api/readings/stats    — aggregated stats (?deviceId=&hours=24)
router.get('/stats', getStats);

// GET    /api/readings          — paginated list (?deviceId=&page=1&limit=50)
router.get('/', getReadings);

export default router;
