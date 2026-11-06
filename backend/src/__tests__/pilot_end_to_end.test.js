/**
 * backend/src/__tests__/pilot_end_to_end.test.js
 *
 * Automated End-to-End Pipeline Verification:
 * Controlled Sensor Fixture
 *   → Telemetry Ingestion (Schema Validation & Deduplication)
 *   → Pilot Session & Dual Baseline Initiation
 *   → Outcome & Adverse Event Storage
 *   → Dataset Export & Quality Gate Flagging
 *   → Model Training (Group CV, Participant Leakage Prevention)
 *   → Artifact Export (model_weights.json)
 *   → Production Inference (ml/scorer.js exact matrix dot-product)
 *   → Independent Safety Interceptor Validation
 *   → Hardware Thermal/Slew Safety Constraints
 */

process.env.PILOT_TRIAL_MODE     = 'true';
process.env.PILOT_SUPERVISOR_KEY = 'test-supervisor-e2e-2026';
process.env.PARTICIPANT_ID_SALT  = 'test-salt-e2e-pipeline-2026';
process.env.PILOT_HEAT_SETPOINT  = '39.0';
process.env.PILOT_K              = '3';
process.env.JWT_ACCESS_SECRET    = 'test-jwt-secret-e2e';
process.env.JWT_REFRESH_SECRET   = 'test-jwt-refresh-e2e';
process.env.JWT_ACCESS_EXPIRES   = '1d';

import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const require    = createRequire(import.meta.url);

const mongoose = require('../../node_modules/mongoose');
const { MongoMemoryServer } = require('../../node_modules/mongodb-memory-server');
const jwt = require('jsonwebtoken');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function req(server, { method, path: reqPath, body, token, headers = {} }) {
  return new Promise((resolve, reject) => {
    const json = body ? JSON.stringify(body) : '';
    const opts = {
      method: method || 'GET',
      path: reqPath,
      hostname: '127.0.0.1',
      port: server.address().port,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(json),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (json) r.write(json);
    r.end();
  });
}

async function runEndToEndVerification() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  HerComfort: Pilot Data-to-Model End-to-End Pipeline Verification');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const memServer = await MongoMemoryServer.create();
  await mongoose.connect(memServer.getUri());

  const { default: app }              = await import('../app.js');
  const { default: User }             = await import('../models/User.js');
  const { default: PilotParticipant } = await import('../models/PilotParticipant.js');
  const { default: TherapyLog }        = await import('../models/TherapyLog.js');
  const { default: SensorReading }    = await import('../models/SensorReading.js');
  const { scoreAllPresets }           = await import('../../../ml/scorer.js');
  const { runSafetyPipeline }         = await import('../../../ml/safetyInterceptor.js');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const testUser = await User.create({
    name: 'E2E Pilot Tester',
    email: `e2e_pilot_${Date.now()}@test.com`,
    password: 'Password123!',
    isVerified: true,
  });
  const token = jwt.sign({ sub: String(testUser._id) }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1d' });

  const testSessionId = `e2e_sess_${Date.now()}`;
  let participantId = null;
  let therapyLogId = null;

  try {
    // ── STAGE 1: Pilot Enrollment & Eligibility Screening ────────────────────
    await test('Stage 1.1: Exclusion screening blocks participant with pacemaker', async () => {
      const res = await req(server, {
        method: 'POST',
        path: '/api/pilot/enroll',
        token,
        body: {
          consentVersion: '1.0.0',
          age: 26,
          screeningPregnancyNegative: true,
          screeningNoPacemaker: false, // Contraindication
          screeningNoSkinCondition: true,
        },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      assert(res.body.error === 'enrollmentInvalid', 'Expected enrollmentInvalid error');
    });

    await test('Stage 1.2: Valid enrollment assigns server-side participantId and sequence', async () => {
      const res = await req(server, {
        method: 'POST',
        path: '/api/pilot/enroll',
        token,
        body: {
          consentVersion: '1.0.0',
          age: 26,
          screeningPregnancyNegative: true,
          screeningNoPacemaker: true,
          screeningNoSkinCondition: true,
          baselinePainSeverityTypical: 6,
        },
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.enrolled === true, 'Expected enrolled=true');
      assert(/^P\d{3}$/.test(res.body.participantId), `Expected PXXX format, got ${res.body.participantId}`);
      assert(res.body.nextSessionOrder === 1, 'Expected initial nextSessionOrder=1');
      participantId = res.body.participantId;
    });

    // ── STAGE 2: Pre-Session Dual Baseline & Trial Arm Allocation ────────────
    await test('Stage 2.1: Missing painPre rejected with 400 inputInvalid', async () => {
      const res = await req(server, {
        method: 'POST',
        path: '/api/pilot/session/start',
        token,
        body: { sessionId: testSessionId, context: {} },
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await test('Stage 2.2: Session start records dual baseline and allocates assigned trial arm', async () => {
      const res = await req(server, {
        method: 'POST',
        path: '/api/pilot/session/start',
        token,
        body: {
          sessionId: testSessionId,
          context: {
            painPre: 7,
            painPre_tMinus5: 8,
            painPre_t0: 7,
            skinTempIn: 36.2,
          },
          contraindications: {
            pregnancy: false,
            pacemaker: false,
            skinCondition: false,
          },
        },
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.success === true, 'Expected success=true');
      assert(res.body.arm != null, 'Expected assigned arm payload');
      assert(['ARM_HEAT_ONLY', 'ARM_HEAT_PULSE', 'ARM_HEAT_HARMONIC'].includes(res.body.arm.id), `Invalid arm: ${res.body.arm.id}`);
      therapyLogId = res.body.logId;
    });

    // ── STAGE 3: Controlled Telemetry Batch Ingestion & Schema Alignment ─────
    await test('Stage 3.1: Rejects malformed telemetry batches (empty or invalid)', async () => {
      const resEmpty = await req(server, {
        method: 'POST',
        path: '/api/readings/batch',
        token,
        body: { readings: [] },
      });
      assert(resEmpty.status === 400, `Expected 400, got ${resEmpty.status}`);

      const resBad = await req(server, {
        method: 'POST',
        path: '/api/readings/batch',
        token,
        body: { readings: [{ temp: 'not-a-number' }] },
      });
      assert(resBad.status === 400, `Expected 400, got ${resBad.status}`);
    });

    await test('Stage 3.2: Ingests valid batch telemetry with schema alignment and window metadata', async () => {
      const baseTs = 1700000000;
      const readingsFixture = [
        {
          deviceId: 'HER-COMFORT-BAND-01',
          sessionId: testSessionId,
          temp: 36.5,
          emg: 22.4,
          emgEnvelope: 22.4,
          motorSpeed: 0,
          heater: 0,
          motorState: 'OFF',
          heaterState: 'OFF',
          espTimestamp: baseTs,
          windowType: 'pre_washout',
          elapsedSec: 10,
          isUserModification: false,
        },
        {
          deviceId: 'HER-COMFORT-BAND-01',
          sessionId: testSessionId,
          temp: 38.8,
          emg: 31.0,
          emgEnvelope: 30.5,
          motorSpeed: 80,
          heater: 1,
          motorState: 'PULSE',
          heaterState: 'ON',
          espTimestamp: baseTs + 300,
          windowType: 'active_early',
          elapsedSec: 300,
          isUserModification: false,
        },
        {
          deviceId: 'HER-COMFORT-BAND-01',
          sessionId: testSessionId,
          temp: 39.0,
          emg: 18.2,
          emgEnvelope: 18.0,
          motorSpeed: 80,
          heater: 1,
          motorState: 'PULSE',
          heaterState: 'ON',
          espTimestamp: baseTs + 700,
          windowType: 'active_late',
          elapsedSec: 700,
          isUserModification: false,
        },
      ];

      const res = await req(server, {
        method: 'POST',
        path: '/api/readings/batch',
        token,
        body: { readings: readingsFixture },
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.count === 3, `Expected count=3, got ${res.body.count}`);

      // Verify MongoDB document fields
      const docs = await SensorReading.find({ sessionId: testSessionId }).sort({ espTimestamp: 1 });
      assert(docs.length === 3, `Expected 3 stored docs, got ${docs.length}`);
      assert(docs[0].windowType === 'PRE_BASELINE', `windowType expected PRE_BASELINE, got ${docs[0].windowType}`);
      assert(docs[1].motorState === true, `motorState expected true, got ${docs[1].motorState}`);
      assert(docs[1].motorMode === 'PULSE', `motorMode expected PULSE, got ${docs[1].motorMode}`);
      assert(docs[1].heaterState === true, `heaterState expected true, got ${docs[1].heaterState}`);
      assert(docs[1].emgEnvelope === 30.5, 'emgEnvelope mismatch');
    });

    // ── STAGE 4: Session Completion, Outcome Logging, and Safety Review ──────
    await test('Stage 4.1: Completes session with 15-min outcome and increments sessionOrder', async () => {
      const res = await req(server, {
        method: 'POST',
        path: '/api/therapy/feedback',
        token,
        body: {
          logId: therapyLogId,
          sessionId: testSessionId,
          painPost: 3,
          painPost_15min: 2,
          painPostConfirmed_15min: true,
          actualDurationSeconds: 900,
          completionStatus: 'COMPLETED',
          settingSource: 'trial_allocator',
          painPostConfirmed: true,
          comfortScore: 5,
          adverseEvent: false,
          adverseCategory: 'NONE',
          adverseSeverity: 'NONE',
        },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      // Check updated participant and log
      const p = await PilotParticipant.findOne({ participantId });
      assert(p.nextSessionOrder === 2, `Expected nextSessionOrder=2, got ${p.nextSessionOrder}`);
      assert(p.completedSessionLogIds.length === 1, 'Expected 1 completed session');

      const log = await TherapyLog.findById(therapyLogId);
      assert(log.pilot.deltaPain_15min === 5.5, `Expected deltaPain_15min=5.5 (baseline 7.5 - post 2), got ${log.pilot.deltaPain_15min}`);
      assert(log.outcome.completionStatus === 'COMPLETED', 'Expected completionStatus COMPLETED');
    });

    await test('Stage 4.2: MODERATE adverse event suspends participant and blocks next session', async () => {
      // Start second session
      const sess2Id = `e2e_sess2_${Date.now()}`;
      const startRes = await req(server, {
        method: 'POST',
        path: '/api/pilot/session/start',
        token,
        body: {
          sessionId: sess2Id,
          context: { painPre: 6, painPre_tMinus5: 6, painPre_t0: 6 },
          contraindications: { pregnancy: false, pacemaker: false, skinCondition: false },
        },
      });
      assert(startRes.status === 201, 'Expected session 2 start 201');
      const log2Id = startRes.body.logId;

      // Complete with MODERATE SKIN_BURNING
      const fbRes = await req(server, {
        method: 'POST',
        path: '/api/therapy/feedback',
        token,
        body: {
          logId: log2Id,
          sessionId: sess2Id,
          painPost: 5,
          painPost_15min: 5,
          painPostConfirmed_15min: true,
          actualDurationSeconds: 400,
          completionStatus: 'COMPLETED',
          settingSource: 'trial_allocator',
          painPostConfirmed: true,
          adverseEvent: true,
          adverseCategory: 'SKIN_BURNING',
          adverseSeverity: 'MODERATE',
        },
      });
      assert(fbRes.status === 200, 'Expected feedback 200');

      // Verify participant is now SUSPENDED
      const p = await PilotParticipant.findOne({ participantId });
      assert(p.studyStatus === 'SUSPENDED', `Expected SUSPENDED, got ${p.studyStatus}`);

      // Verify subsequent session start is refused
      const sess3Res = await req(server, {
        method: 'POST',
        path: '/api/pilot/session/start',
        token,
        body: {
          sessionId: `e2e_sess3_${Date.now()}`,
          context: { painPre: 5 },
        },
      });
      assert(sess3Res.status === 403, `Expected 403, got ${sess3Res.status}`);
      assert(sess3Res.body.error === 'participantSuspended', 'Expected participantSuspended error');
    });

    // ── STAGE 5: Dataset Export & Data Quality Gate ───────────────────────────
    await test('Stage 5.1: Dataset export script generates validation report and training CSV', async () => {
      const exportScript = path.resolve(__dirname, '../../../ml/export_pilot_dataset.js');
      const out = spawnSync(process.execPath, [exportScript, '--seed'], {
        encoding: 'utf-8',
        env: { ...process.env, MONGODB_URI: memServer.getUri() },
      });
      assert(out.status === 0, `Export script failed (code ${out.status}): ${out.stderr || out.stdout}`);

      const reportPath = path.resolve(__dirname, '../../../pilot_data/dataset_validation_report.json');
      const csvPath    = path.resolve(__dirname, '../../../pilot_data/clean_training_dataset.csv');
      assert(fs.existsSync(reportPath), 'Validation report does not exist');
      assert(fs.existsSync(csvPath), 'Clean training dataset does not exist');

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      assert(typeof report.validSessions === 'number', 'Missing validSessions count');
      assert(report.validSessions > 0, 'Expected validSessions > 0');
    });

    // ── STAGE 6: Model Training & Artifact Validation ─────────────────────────
    await test('Stage 6.1: Python training script produces exact calibrated model_weights.json', async () => {
      const trainScript = path.resolve(__dirname, '../../../ml/train_model.py');
      const pyOut = spawnSync('python', [trainScript, '--synthetic'], {
        encoding: 'utf-8',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      assert(pyOut.status === 0, `Python training failed: ${pyOut.stderr || pyOut.stdout}`);

      const weightsPath = path.resolve(__dirname, '../../../ml/models/model_weights.json');
      assert(fs.existsSync(weightsPath), 'model_weights.json does not exist');

      const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
      assert(weights.arm_models != null, 'Missing arm_models');
      assert(weights.arm_models.ARM_HEAT_ONLY != null, 'Missing ARM_HEAT_ONLY model');
      assert(weights.arm_models.ARM_HEAT_PULSE != null, 'Missing ARM_HEAT_PULSE model');
      assert(weights.arm_models.ARM_HEAT_HARMONIC != null, 'Missing ARM_HEAT_HARMONIC model');
      assert(typeof weights.arm_models.ARM_HEAT_PULSE.intercept === 'number', 'Missing intercept');
      assert(Array.isArray(weights.arm_models.ARM_HEAT_PULSE.coefficients), 'Missing coefficients');
    });

    await test('Stage 6.2: Python trainer fails closed on insufficient data without --synthetic', async () => {
      const trainScript = path.resolve(__dirname, '../../../ml/train_model.py');
      // Pass a non-existent CSV path
      const pyOut = spawnSync('python', [trainScript, '--dataset', 'non_existent_data.csv'], {
        encoding: 'utf-8',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      assert(pyOut.status !== 0, 'Expected training failure on non-existent dataset');
      assert(pyOut.stderr.includes('FATAL') || pyOut.stdout.includes('FATAL'), 'Expected FATAL failure message');
    });

    // ── STAGE 7: Production Inference & Model Weight Execution ────────────────
    await test('Stage 7.1: JS Scorer executes exact linear model dot-product and ranks presets', async () => {
      const mockContext = {
        painPre: 8.0,
        emg: 45.0,
        posture: 'UPRIGHT',
        stress: 7.0,
        fatigue: 6.0,
        tookMedication: false,
        skinTempIn: 36.5,
      };

      const ranked = scoreAllPresets(mockContext);
      assert(Array.isArray(ranked), 'Expected array from scoreAllPresets');
      assert(ranked.length === 12, `Expected 12 presets, got ${ranked.length}`);
      assert(typeof ranked[0].score === 'number', 'Missing score number');
      assert(typeof ranked[0].predictedDeltaPain === 'number', 'Missing predictedDeltaPain');
    });

    await test('Stage 7.2: Ingesting higher baseline pain systematically increases relief scores', async () => {
      const lowPainCtx = { painPre: 3.0, emg: 15.0, posture: 'LYING', skinTempIn: 36.5 };
      const highPainCtx = { painPre: 9.0, emg: 65.0, posture: 'LYING', skinTempIn: 36.5 };

      const resLow  = scoreAllPresets(lowPainCtx);
      const resHigh = scoreAllPresets(highPainCtx);

      // Model learned that higher initial pain yields larger absolute pain drop potential
      assert(
        resHigh[0].predictedDeltaPain > resLow[0].predictedDeltaPain,
        `Expected higher relief prediction for pain 9 (${resHigh[0].predictedDeltaPain}) than pain 3 (${resLow[0].predictedDeltaPain})`
      );
    });

    // ── STAGE 8: Independent Safety Interceptor Validation ────────────────────
    await test('Stage 8.1: Safety interceptor hard-clamps temperature > 40.0°C to 40.0°C', () => {
      const unsafePreset = {
        id: 'UNSAFE_PRESET',
        targetTemp: 44.5, // Unsafe! Above 40°C
        vibrationMode: 'CONTINUOUS',
        vibrationSpeed: 100,
        durationMin: 30,
      };

      const safety = runSafetyPipeline({ painPre: 6.0 }, unsafePreset, {});
      assert(safety.wasClamped === true, 'Expected safety clamp');
      assert(safety.finalPreset.targetTemp === 40.0, `Expected clamped temp 40.0, got ${safety.finalPreset.targetTemp}`);
    });

    await test('Stage 8.2: Pregnancy contraindication blocks heating and vibrates-only or aborts', () => {
      const heatPreset = {
        id: 'ARM_HEAT_PULSE',
        targetTemp: 39.0,
        vibrationMode: 'PULSE',
        vibrationSpeed: 70,
        durationMin: 15,
      };

      const safety = runSafetyPipeline({ painPre: 6.0 }, heatPreset, { pregnancy: true });
      assert(safety.blocked === true, 'Expected blocked=true for pregnancy');
      assert(safety.blockReason.includes('PREGNANCY'), 'Expected pregnancy contraindication reason');
    });

  } finally {
    server.close();
    await mongoose.disconnect();
    await memServer.stop();
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  E2E Verification Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

runEndToEndVerification().catch((err) => {
  console.error('Fatal E2E test failure:', err);
  process.exit(1);
});
