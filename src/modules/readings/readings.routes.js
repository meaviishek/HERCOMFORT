const express = require('express');
const {
  createReading,
  getReadings,
  getLatestReading,
  getStats,
} = require('./readings.controller');

const router = express.Router();

// POST   /api/readings          — store new reading from mobile app
router.post('/', createReading);

// GET    /api/readings/latest   — most recent reading (optional ?deviceId=)
router.get('/latest', getLatestReading);

// GET    /api/readings/stats    — aggregated stats (?deviceId=&hours=24)
router.get('/stats', getStats);

// GET    /api/readings          — paginated list (?deviceId=&page=1&limit=50)
router.get('/', getReadings);

module.exports = router;
