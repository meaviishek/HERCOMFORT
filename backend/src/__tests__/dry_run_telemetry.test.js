/**
 * backend/src/__tests__/dry_run_telemetry.test.js
 *
 * Checkpoint 23: Hardware-to-Database Dry-Run Telemetry Validation
 *
 * Verifies that sensor packets can travel from the ESP32 through BLE and the mobile app
 * into the backend and MongoDB without corrupting timestamps, units, participant/session
 * linkage, or telemetry integrity.
 *
 * Tests:
 *   T01: Malformed packet payloads (empty array, null reading, non-object) -> 400
 *   T02: Missing temperature -> 400
 *   T03: Out-of-range sensor temperature (< 0°C or > 60°C) -> 400
 *   T04: Out-of-range EMG values (negative EMG or emgEnvelope > 100) -> 400
 *   T05: Timestamp distinguishability: espTimestamp (hardware) vs receivedAt (server UTC)
 *   T06: In-batch duplicate packet deduplication prevents duplicate records
 *   T07: Cross-batch retry duplicate rejection via unique index without silent sample inflation
 *   T08: Chronological ordering: out-of-order packets are sorted by espTimestamp
 *   T09: Unit and metadata preservation (temperature in °C, bodyAngle in °, emgEnvelope in 0-100, motorSpeed in 0-100)
 *   T10: Disconnect & Stale session handling: >3h IN_PROGRESS marked ABANDONED without consuming nextSessionOrder
 *   T11: Session cancellation: CANCELLED session does NOT consume nextSessionOrder
 */

import http from 'http';
import { createRequire } from 'module';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_ACCESS_SECRET = 'test_access_secret_1234567890';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_1234567890';
process.env.NODE_ENV = 'test';
process.env.PILOT_SUPERVISOR_KEY = 'valid_test_supervisor_key';
process.env.PARTICIPANT_ID_SALT = 'salt-for-pilot-trial-tests-2026';
process.env.PILOT_HEAT_SETPOINT = '39.0';
process.env.PILOT_K = '3';
process.env.PILOT_TRIAL_MODE = 'true';

const appModule = await import('../app.js');
const app = appModule.default;
const User = (await import('../models/User.js')).default;
const PilotParticipant = (await import('../models/PilotParticipant.js')).default;
const TherapyLog = (await import('../models/TherapyLog.js')).default;
const SensorReading = (await import('../models/SensorReading.js')).default;
const { cleanupStaleSessions } = await import('../modules/pilot/pilot.routes.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}: ${err.message}`);
    failed++;
  }
}

function req(server, { method, path, body, token }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(data);

    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function run() {
  console.log('\n📡  Hardware-to-Database Telemetry & Dry-Run Validation Tests\n');

  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Ensure indexes (including partial unique index on (sessionId, espTimestamp))
  await SensorReading.init();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const testUser = await User.create({
    name: 'Hardware Validation User',
    email: `hw_val_${Date.now()}@test.com`,
    password: 'Password123!',
    isVerified: true,
  });
  const token = jwt.sign({ sub: String(testUser._id) }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' });

  // Enroll in pilot study
  await req(server, {
    method: 'POST',
    path: '/api/pilot/enroll',
    token,
    body: {
      consentVersion: '1.0.0',
      age: 27,
      screeningPregnancyNegative: true,
      screeningNoPacemaker: true,
      screeningNoSkinCondition: true,
      baselinePainSeverityTypical: 7,
    },
  });

  const testSessionId = `dryrun_sess_${Date.now()}`;

  // Start a valid pilot session
  const startRes = await req(server, {
    method: 'POST',
    path: '/api/pilot/session/start',
    token,
    body: {
      sessionId: testSessionId,
      context: { painPre: 7, skinTempIn: 36.4 },
      contraindications: { pregnancy: false, pacemaker: false, skinCondition: false },
    },
  });
  assert(startRes.status === 201, `Failed to start session: ${startRes.status}`);

  // ── T01: Malformed Packet Payloads ──────────────────────────────────────────
  await test('T01: Malformed payloads (empty array, non-object) rejected with 400', async () => {
    const emptyRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: { readings: [] },
    });
    assert(emptyRes.status === 400, `Expected 400 for empty array, got ${emptyRes.status}`);

    const nonObjectRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: { readings: ['invalid_string_payload'] },
    });
    assert(nonObjectRes.status === 400, `Expected 400 for non-object reading, got ${nonObjectRes.status}`);
  });

  // ── T02: Missing Temperature ───────────────────────────────────────────────
  await test('T02: Missing or non-numeric temperature rejected with 400', async () => {
    const missingTempRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: testSessionId, emg: 15.0 },
        ],
      },
    });
    assert(missingTempRes.status === 400, `Expected 400 for missing temp, got ${missingTempRes.status}`);

    const nanTempRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: testSessionId, temp: 'NaN' },
        ],
      },
    });
    assert(nanTempRes.status === 400, `Expected 400 for NaN temp, got ${nanTempRes.status}`);
  });

  // ── T03: Out-of-Range Sensor Temperature ───────────────────────────────────
  await test('T03: Out-of-range sensor temperature (<0°C or >60°C) rejected with 400', async () => {
    // DS18B20 disconnect reading (-127°C)
    const negativeTempRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: testSessionId, temp: -127 },
        ],
      },
    });
    assert(negativeTempRes.status === 400, `Expected 400 for -127°C, got ${negativeTempRes.status}`);

    // Sensor short-circuit reading (>60°C)
    const highTempRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: testSessionId, temp: 85.0 },
        ],
      },
    });
    assert(highTempRes.status === 400, `Expected 400 for 85°C, got ${highTempRes.status}`);
  });

  // ── T04: Out-of-Range EMG Values ───────────────────────────────────────────
  await test('T04: Out-of-range EMG (negative or envelope > 100) rejected with 400', async () => {
    const negEmgRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: testSessionId, temp: 36.5, emg: -5 },
        ],
      },
    });
    assert(negEmgRes.status === 400, `Expected 400 for negative EMG, got ${negEmgRes.status}`);

    const highEnvRes = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: testSessionId, temp: 36.5, emgEnvelope: 150 },
        ],
      },
    });
    assert(highEnvRes.status === 400, `Expected 400 for emgEnvelope > 100, got ${highEnvRes.status}`);
  });

  // ── T05: Timestamp Distinguishability ───────────────────────────────────────
  await test('T05: espTimestamp (sensor hardware) and receivedAt (server UTC) remain distinguishable', async () => {
    const hwEpoch = 1729700000500;
    const res = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          {
            deviceId: 'HER-COMFORT-BAND-01',
            sessionId: testSessionId,
            temp: 36.7,
            emg: 20.0,
            emgEnvelope: 20.0,
            espTimestamp: hwEpoch,
            windowType: 'pre_washout',
            elapsedSec: 15,
          },
        ],
      },
    });
    assert(res.status === 201, `Batch ingest failed: ${res.status}`);

    const doc = await SensorReading.findOne({ sessionId: testSessionId, espTimestamp: hwEpoch });
    assert(doc != null, 'Reading not found in MongoDB');
    assert(doc.espTimestamp === hwEpoch, `espTimestamp mismatch: ${doc.espTimestamp} vs ${hwEpoch}`);
    assert(doc.receivedAt instanceof Date, 'receivedAt must be a Date object');
    assert(!isNaN(doc.receivedAt.getTime()), 'receivedAt must be valid Date');
    // Ensure espTimestamp is not silently overwritten with server receivedAt
    assert(doc.espTimestamp !== doc.receivedAt.getTime(), 'espTimestamp must not be equal to server receivedAt');
  });

  // ── T06: In-Batch Duplicate Packet Deduplication ────────────────────────────
  await test('T06: In-batch duplicate packets with identical espTimestamp are deduplicated', async () => {
    const hwEpoch = 1729700001000;
    const duplicateBatch = [
      {
        deviceId: 'BAND-01',
        sessionId: testSessionId,
        temp: 36.8,
        emgEnvelope: 18.0,
        espTimestamp: hwEpoch,
        elapsedSec: 20,
      },
      {
        deviceId: 'BAND-01',
        sessionId: testSessionId,
        temp: 36.8,
        emgEnvelope: 18.0,
        espTimestamp: hwEpoch, // exact duplicate frame in same payload
        elapsedSec: 20,
      },
    ];

    const res = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: { readings: duplicateBatch },
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.body.count === 1, `Expected count=1 after in-batch dedupe, got ${res.body.count}`);

    const countInDb = await SensorReading.countDocuments({ sessionId: testSessionId, espTimestamp: hwEpoch });
    assert(countInDb === 1, `Expected exactly 1 document in DB, found ${countInDb}`);
  });

  // ── T07: Cross-Batch Retry Duplicate Rejection ──────────────────────────────
  await test('T07: Cross-batch duplicate packets rejected without silent sample inflation', async () => {
    const hwEpoch = 1729700002000;
    const initialPayload = [
      {
        deviceId: 'BAND-01',
        sessionId: testSessionId,
        temp: 36.9,
        emgEnvelope: 21.0,
        espTimestamp: hwEpoch,
        elapsedSec: 30,
      },
    ];

    // First attempt
    const res1 = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: { readings: initialPayload },
    });
    assert(res1.status === 201 && res1.body.count === 1, 'Initial batch should succeed with count 1');

    // Simulated network retry of the exact same batch payload
    const res2 = await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: { readings: initialPayload },
    });
    // Should succeed idempotently without throwing 500
    assert(res2.status === 201, `Retry expected 201, got ${res2.status}`);
    assert(res2.body.count === 0, `Retry expected count=0 inserted docs, got ${res2.body.count}`);

    const totalDocs = await SensorReading.countDocuments({ sessionId: testSessionId, espTimestamp: hwEpoch });
    assert(totalDocs === 1, `Expected exactly 1 doc after retry, found ${totalDocs} (duplicate silently inflated count)`);
  });

  // ── T08: Chronological Ordering ─────────────────────────────────────────────
  await test('T08: Out-of-order packets are correctly sorted by espTimestamp on query', async () => {
    const sid = `ordering_sess_${Date.now()}`;
    const t0 = 1729700010000;
    // Ingest packets out of order (t2, then t0, then t1)
    await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: {
        readings: [
          { deviceId: 'BAND-01', sessionId: sid, temp: 37.2, espTimestamp: t0 + 2000 },
          { deviceId: 'BAND-01', sessionId: sid, temp: 36.5, espTimestamp: t0 },
          { deviceId: 'BAND-01', sessionId: sid, temp: 36.8, espTimestamp: t0 + 1000 },
        ],
      },
    });

    const sortedDocs = await SensorReading.find({ sessionId: sid }).sort({ espTimestamp: 1 }).lean();
    assert(sortedDocs.length === 3, `Expected 3 docs, got ${sortedDocs.length}`);
    assert(sortedDocs[0].espTimestamp === t0, `Expected first doc at t0, got ${sortedDocs[0].espTimestamp}`);
    assert(sortedDocs[1].espTimestamp === t0 + 1000, `Expected second doc at t0+1000, got ${sortedDocs[1].espTimestamp}`);
    assert(sortedDocs[2].espTimestamp === t0 + 2000, `Expected third doc at t0+2000, got ${sortedDocs[2].espTimestamp}`);
    assert(sortedDocs[0].temp === 36.5, `Temperature ordering mismatch: ${sortedDocs[0].temp}`);
  });

  // ── T09: Unit and Metadata Preservation ─────────────────────────────────────
  await test('T09: Preserves physical units (°C, bodyAngle, emgEnvelope, motorSpeed, motorMode)', async () => {
    const sid = `units_sess_${Date.now()}`;
    const ts = 1729700020000;
    const packet = {
      deviceId: 'HER-COMFORT-C6',
      sessionId: sid,
      temp: 39.4,             // degrees C
      bodyAngle: 12.5,        // degrees
      motorSpeed: 85,         // percentage 0-100
      motorMode: 'HARMONIC',  // enum string
      heaterSetpoint: 39.5,   // degrees C
      emgEnvelope: 42.8,      // BioAmp envelope 0-100
      position: 'UPRIGHT',
      espTimestamp: ts,
    };

    await req(server, {
      method: 'POST',
      path: '/api/readings/batch',
      token,
      body: { readings: [packet] },
    });

    const doc = await SensorReading.findOne({ sessionId: sid, espTimestamp: ts }).lean();
    assert(doc != null, 'Doc not found');
    assert(doc.temp === 39.4, `Temp unit corrupted: ${doc.temp}`);
    assert(doc.bodyAngle === 12.5, `Body angle corrupted: ${doc.bodyAngle}`);
    assert(doc.motorSpeed === 85, `Motor speed corrupted: ${doc.motorSpeed}`);
    assert(doc.motorMode === 'HARMONIC', `Motor mode corrupted: ${doc.motorMode}`);
    assert(doc.heaterSetpoint === 39.5, `Heater setpoint corrupted: ${doc.heaterSetpoint}`);
    assert(doc.emgEnvelope === 42.8, `EMG envelope corrupted: ${doc.emgEnvelope}`);
    assert(doc.position === 'UPRIGHT', `Position corrupted: ${doc.position}`);
  });

  // ── T10: Disconnect & Stale Session Handling ────────────────────────────────
  await test('T10: Stale IN_PROGRESS sessions (>3h) marked ABANDONED without consuming nextSessionOrder', async () => {
    const participantBefore = await PilotParticipant.findOne({ userId: testUser._id });
    const orderBefore = participantBefore.nextSessionOrder;

    // Create an artificial stale session older than 3 hours
    const staleSessionId = `stale_sess_${Date.now()}`;
    await TherapyLog.create({
      userId: testUser._id,
      sessionId: staleSessionId,
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      context: { painPre: 6 },
      preset: {
        presetId: 'ARM_HEAT_PULSE',
        presetName: 'ARM_HEAT_PULSE',
        targetTemp: 39.0,
        vibrationMode: 'PULSE',
        vibrationSpeed: 80,
        durationMin: 20,
      },
      outcome: { completionStatus: 'IN_PROGRESS' },
      pilot: { trialArm: 'ARM_HEAT_PULSE', sessionOrderForParticipant: orderBefore },
    });

    await cleanupStaleSessions(testUser._id);

    const staleLog = await TherapyLog.findOne({ sessionId: staleSessionId });
    assert(staleLog.outcome.completionStatus === 'ABANDONED', `Expected ABANDONED, got ${staleLog.outcome.completionStatus}`);

    const participantAfter = await PilotParticipant.findOne({ userId: testUser._id });
    assert(
      participantAfter.nextSessionOrder === orderBefore,
      `nextSessionOrder must NOT be consumed by ABANDONED session (${participantAfter.nextSessionOrder} vs ${orderBefore})`
    );
  });

  // ── T11: Session Cancellation Does Not Consume Session Order ─────────────────
  await test('T11: Session cancellation marks CANCELLED without consuming nextSessionOrder', async () => {
    const participant = await PilotParticipant.findOne({ userId: testUser._id });
    const orderBefore = participant.nextSessionOrder;

    const cancelRes = await req(server, {
      method: 'POST',
      path: '/api/pilot/session/cancel',
      token,
      body: { logId: startRes.body.logId, reason: 'Volunteer stepped away' },
    });
    assert(cancelRes.status === 200, `Expected 200 on cancel, got ${cancelRes.status}`);

    const log = await TherapyLog.findOne({ sessionId: testSessionId });
    assert(log.outcome.completionStatus === 'CANCELLED', `Expected CANCELLED, got ${log.outcome.completionStatus}`);

    const participantAfter = await PilotParticipant.findOne({ userId: testUser._id });
    assert(
      participantAfter.nextSessionOrder === orderBefore,
      `nextSessionOrder must NOT be consumed by CANCELLED session (${participantAfter.nextSessionOrder} vs ${orderBefore})`
    );
  });

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  server.close();
  await mongoose.disconnect();
  await mongod.stop();

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
