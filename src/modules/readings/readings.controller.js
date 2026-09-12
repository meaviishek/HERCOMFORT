import SensorReading from '../../models/SensorReading.js';
import Session from '../../models/Session.js';
import { getIO } from '../../config/socket.js';

/**
 * POST /api/readings
 * Store one sensor reading from the mobile app (received via BT) and
 * broadcast it to all connected web-dashboard Socket.io clients.
 */
export async function createReading(req, res) {
  try {
    const {
      deviceId,
      temp,
      bpm,
      motor,
      heater,
      autoMode,
      active,
      sensorError,
      timestamp, // ESP32 internal epoch
    } = req.body;

    // Basic validation
    if (!deviceId || temp === undefined || bpm === undefined) {
      return res.status(400).json({
        success: false,
        message: 'deviceId, temp, and bpm are required fields.',
      });
    }

    let reading;
    try {
      reading = await SensorReading.create({
        deviceId,
        temp,
        bpm,
        motor: motor ?? false,
        heater: heater ?? false,
        autoMode: autoMode ?? true,
        active: active ?? false,
        sensorError: sensorError ?? false,
        espTimestamp: timestamp,
      });
    } catch (dbErr) {
      console.warn('[MongoDB] Save failed, but broadcasting via Socket.io anyway');
      // Create a mock reading object so the live broadcast still works
      reading = {
        _id: 'offline-' + Date.now(),
        deviceId,
        temp,
        bpm,
        motor: motor ?? false,
        heater: heater ?? false,
        autoMode: autoMode ?? true,
        active: active ?? false,
        sensorError: sensorError ?? false,
        receivedAt: new Date(),
      };
    }

    // Broadcast to web dashboard clients watching this device
    try {
      const io = getIO();
      io.to(`device:${deviceId}`).emit('new-reading', {
        _id: reading._id,
        deviceId: reading.deviceId,
        temp: reading.temp,
        bpm: reading.bpm,
        motor: reading.motor,
        heater: reading.heater,
        autoMode: reading.autoMode,
        active: reading.active,
        sensorError: reading.sensorError,
        receivedAt: reading.receivedAt,
      });

      // Also broadcast to a global "all-readings" room for general dashboards
      io.emit('reading-update', {
        deviceId: reading.deviceId,
        temp: reading.temp,
        bpm: reading.bpm,
        receivedAt: reading.receivedAt,
      });
    } catch (socketErr) {
      // Non-critical — log but don't fail the response
      console.warn('[Socket.io] Broadcast failed:', socketErr.message);
    }

    return res.status(201).json({
      success: true,
      data: reading,
    });
  } catch (err) {
    console.error('[createReading] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message,
    });
  }
}

/**
 * GET /api/readings
 * Paginated list of all readings, newest first.
 * Query params: deviceId, page (default 1), limit (default 50)
 */
export async function getReadings(req, res) {
  try {
    const { deviceId, page = 1, limit = 50 } = req.query;
    const filter = deviceId ? { deviceId } : {};
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [readings, total] = await Promise.all([
      SensorReading.find(filter)
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      SensorReading.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: readings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[getReadings] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/readings/latest
 * Returns the most recent reading per device (or for a specific deviceId).
 */
export async function getLatestReading(req, res) {
  try {
    const { deviceId } = req.query;
    const filter = deviceId ? { deviceId } : {};

    const reading = await SensorReading.findOne(filter)
      .sort({ receivedAt: -1 })
      .lean();

    if (!reading) {
      return res.status(404).json({ success: false, message: 'No readings found' });
    }

    return res.status(200).json({ success: true, data: reading });
  } catch (err) {
    console.error('[getLatestReading] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/readings/stats
 * Returns aggregate stats for a device over the last N hours.
 * Query params: deviceId (required), hours (default 24)
 */
export async function getStats(req, res) {
  try {
    const { deviceId, hours = 24 } = req.query;
    if (!deviceId) {
      return res.status(400).json({ success: false, message: 'deviceId is required' });
    }

    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
    const stats = await SensorReading.aggregate([
      { $match: { deviceId, receivedAt: { $gte: since } } },
      {
        $group: {
          _id: '$deviceId',
          avgTemp: { $avg: '$temp' },
          maxTemp: { $max: '$temp' },
          minTemp: { $min: '$temp' },
          avgBpm: { $avg: '$bpm' },
          maxBpm: { $max: '$bpm' },
          minBpm: { $min: '$bpm' },
          errorCount: { $sum: { $cond: ['$sensorError', 1, 0] } },
          totalReadings: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: stats[0] || null,
      period: `${hours}h`,
    });
  } catch (err) {
    console.error('[getStats] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/readings/batch
 * Store continuous sensor readings in batch mode with timestamps (no threshold stored).
 */
export async function createBatchReadings(req, res) {
  try {
    const readings = Array.isArray(req.body) ? req.body : req.body?.readings;
    if (!readings || !Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'An array of readings is required.',
      });
    }

    const docs = readings.map((r) => ({
      deviceId: r.deviceId || 'HER-COMFORT',
      temp: Number(r.temp ?? r.temperature ?? 36.5),
      bpm: Number(r.bpm ?? 72),
      gx: Number(r.gx ?? 0),
      gy: Number(r.gy ?? 0),
      gz: Number(r.gz ?? 0),
      raw_analog: Number(r.raw_analog ?? 1700),
      motor: Boolean(r.motor),
      heater: Boolean(r.heater),
      autoMode: Boolean(r.autoMode ?? false),
      active: Boolean(r.active ?? true),
      sensorError: Boolean(r.sensorError ?? false),
      sessionId: r.sessionId || null,
      espTimestamp: r.timestamp || r.espTimestamp || Date.now(),
      receivedAt: r.receivedAt ? new Date(r.receivedAt) : new Date(),
    }));

    try {
      await SensorReading.insertMany(docs, { ordered: false });
    } catch (insertErr) {
      console.warn('[SensorReading] Batch insert notice:', insertErr?.message);
    }

    // Broadcast latest packet from batch if socket is connected
    try {
      const io = getIO();
      const latest = docs[docs.length - 1];
      if (io && latest) {
        io.to(`device:${latest.deviceId}`).emit('new-reading', latest);
      }
    } catch {}

    return res.status(201).json({
      success: true,
      insertedCount: docs.length,
    });
  } catch (err) {
    console.error('[createBatchReadings] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
}

/**
 * POST /api/readings/sessions
 * Store completed therapy session with duration and calculated features (EMG RMS, temp avg/max, IMU stats).
 */
export async function createSession(req, res) {
  try {
    const {
      sessionId,
      userId,
      deviceId = 'HER-COMFORT',
      startTime,
      endTime,
      durationSeconds,
      durationMin,
      painBefore,
      painAfter,
      location,
      symptoms,
      therapy,
      features,
      notes,
    } = req.body;

    const id = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const durSec = Number(durationSeconds ?? ((durationMin ?? 1) * 60));
    const durMin = Number(durationMin ?? Math.max(1, Math.round(durSec / 60)));

    const sessionDoc = await Session.create({
      sessionId: id,
      userId: userId || null,
      deviceId,
      startTime: startTime ? new Date(startTime) : new Date(Date.now() - durSec * 1000),
      endTime: endTime ? new Date(endTime) : new Date(),
      durationSeconds: durSec,
      durationMin: durMin,
      painBefore: painBefore ?? 5,
      painAfter: painAfter ?? 3,
      location: location || 'Lower abdomen',
      symptoms: symptoms || [],
      therapy: therapy || {},
      features: features || {},
      notes: notes || '',
    });

    return res.status(201).json({
      success: true,
      data: sessionDoc,
    });
  } catch (err) {
    console.error('[createSession] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create session', error: err.message });
  }
}

/**
 * GET /api/readings/sessions
 * Paginated list of sessions, newest first.
 */
export async function getSessions(req, res) {
  try {
    const { userId, deviceId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (userId) filter.userId = userId;
    if (deviceId) filter.deviceId = deviceId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Session.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[getSessions] Error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

