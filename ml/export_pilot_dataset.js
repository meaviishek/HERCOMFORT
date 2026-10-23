/**
 * ml/export_pilot_dataset.js
 *
 * Pilot Dataset Exporter — HerComfort Pilot Feasibility Study
 *
 * Updated to the full pilot schema (TherapyLog.pilot.* + SensorReading.windowType).
 *
 * Outputs two CSVs:
 *   1. pilot_data/sessions.csv     — one row per COMPLETED pilot session with confirmed
 *                                    primary outcome (painPostConfirmed_15min=true OR
 *                                    legacy painPostConfirmed=true for non-pilot rows)
 *   2. pilot_data/telemetry.csv    — one row per session: per-window EMG aggregates,
 *                                    telemetry quality, modification events
 *
 * Filters (must ALL be true):
 *   - outcome.completionStatus = 'COMPLETED'
 *   - outcome.painPostConfirmed = true           (legacy sessions)
 *   OR pilot.painPostConfirmed_15min = true      (pilot sessions — primary outcome gate)
 *
 * Usage:
 *   node ml/export_pilot_dataset.js              # uses DATABASE_URL env
 *   node ml/export_pilot_dataset.js --seed       # seeds synthetic pilot data, then exports
 *   node ml/export_pilot_dataset.js --out=./my_dir
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

const mongoose = require('../backend/node_modules/mongoose');

// ── CLI args ──────────────────────────────────────────────────────────────────
const outDirArg  = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
const OUT_DIR    = outDirArg ?? path.join(__dirname, '..', 'pilot_data');
const FORCE_SEED = process.argv.includes('--seed') || process.argv.includes('--demo');

// ── Loose schemas (avoids ESM circular imports) ────────────────────────────────
const TherapyLog    = mongoose.model('TherapyLog',    new mongoose.Schema({}, { strict: false, collection: 'therapy_logs' }));
const SensorReading = mongoose.model('SensorReading', new mongoose.Schema({}, { strict: false, collection: 'sensor_readings' }));

// ── CSV helpers ───────────────────────────────────────────────────────────────
function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n') + '\n';
}

function r2(v) { return v == null ? null : Math.round(v * 100) / 100; }
function mean(arr) {
  const c = arr.filter((v) => v != null && !isNaN(v));
  return c.length ? r2(c.reduce((a, b) => a + b, 0) / c.length) : null;
}
function rms(arr) {
  const c = arr.filter((v) => v != null && !isNaN(v));
  return c.length ? r2(Math.sqrt(c.reduce((a, b) => a + b * b, 0) / c.length)) : null;
}
function maxVal(arr) {
  const c = arr.filter((v) => v != null && !isNaN(v));
  return c.length ? Math.max(...c) : null;
}
function slope(vals) {
  const n = vals.length;
  if (n < 2) return null;
  const xM = (n - 1) / 2, yM = vals.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - xM) * (vals[i] - yM); den += (i - xM) ** 2; }
  return den === 0 ? 0 : r2(num / den);
}

// ── Seed: synthetic pilot data with new schema fields ────────────────────────
async function seedPilotData() {
  console.log('🌱  Seeding synthetic pilot data (new schema)…');

  const uids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const ARMS = ['ARM_HEAT_ONLY', 'ARM_HEAT_PULSE', 'ARM_HEAT_HARMONIC'];

  // 3 participants × 3 sessions each = 9 sessions
  const sessions = [];
  let pidCounter = 0;

  for (let u = 0; u < 3; u++) {
    pidCounter++;
    const pid = `P${String(pidCounter).padStart(3, '0')}`;
    for (let s = 0; s < 3; s++) {
      const arm = ARMS[s % 3];
      const painPre = 5 + Math.random() * 4;               // 5–9
      const effect  = arm === 'ARM_HEAT_PULSE' ? 1.5 : arm === 'ARM_HEAT_HARMONIC' ? 1.0 : 0.5;
      const painPost_15min = Math.max(0, painPre - effect - Math.random() * 0.5);
      const painPost_0min  = Math.max(0, painPre - effect * 0.6 - Math.random() * 0.3);
      const baseline       = r2((painPre + (painPre - 0.3)) / 2);

      const sessionId = `sess_${pid}_s${s + 1}`;
      sessions.push({
        _id:       new mongoose.Types.ObjectId(),
        userId:    uids[u],
        sessionId,
        createdAt: new Date(Date.now() - (9 - u * 3 - s) * 3600000 * 24),
        context: {
          painPre: r2(painPre), emg: 30 + Math.round(Math.random() * 30),
          posture: 'LYING', cycleDay: 1 + s, tookMedication: false, skinTempIn: 36.1,
        },
        preset: {
          presetId:      arm,
          presetName:    arm,
          targetTemp:    39.0,
          vibrationMode: arm === 'ARM_HEAT_ONLY' ? 'OFF' : arm === 'ARM_HEAT_PULSE' ? 'PULSE' : 'HARMONIC',
          vibrationSpeed: arm === 'ARM_HEAT_ONLY' ? 0 : 80,
          durationMin:   20,
        },
        mlAudit: {
          modelVersion:  'pilot-trial-v1.0',
          settingSource: 'trial_allocator',
          propensity:    0.333333,
          wasClamped:    false,
          predictedDeltaPain: null,
        },
        pilot: {
          trialArm:                  arm,
          sessionOrderForParticipant: s + 1,
          sequenceIndex:             u % 6,
          painPre_tMinus5:           r2(painPre - 0.3),
          painPre_t0:                r2(painPre),
          painPre_baseline:          baseline,
          painPost_15min:            r2(painPost_15min),
          painPostConfirmed_15min:   true,
          deltaPain_15min:           r2(baseline - painPost_15min),
          deltaPain_0min:            r2(baseline - painPost_0min),
          adverseEvent:              false,
          adverseCategory:           'NONE',
          adverseSeverity:           'NONE',
          earlyTermination:          false,
          earlyTerminationReason:    'NONE',
          emg_pre_rms:               null,   // computed from telemetry below
          emg_pre_mean:              null,
          emg_post_rms:              null,
          emg_post_mean:             null,
          delta_emg_clean_rms:       null,
          telemetry_packet_count:    null,
          telemetry_packet_loss_pct: null,
          firmwareVersion:           '1.4.2',
          appVersion:                '2.1.0',
        },
        outcome: {
          completionStatus:  'COMPLETED',
          painPost:          r2(painPost_0min),
          painPostConfirmed: true,
          deltaPain:         r2(painPre - painPost_0min),
          actualDurationSeconds: 1200,
        },
        contraindications: { pregnancy: false, pacemaker: false, skinCondition: false, therapyBlocked: false },
      });
    }
  }

  await TherapyLog.insertMany(sessions);

  // Sensor readings: PRE_BASELINE (0–60s), ACTIVE_THERAPY (61–1140s), POST_BASELINE (1141–1200s)
  // ~20 packets at 1/min equivalent (simplified for seed)
  const readings = [];
  for (const sess of sessions) {
    const emgBase = sess.context.emg;
    // PRE_BASELINE: 3 packets at elapsedSec 10, 30, 55
    for (const elapsed of [10, 30, 55]) {
      readings.push({
        deviceId: 'PILOT-BELT-01', sessionId: sess.sessionId,
        receivedAt: new Date(sess.createdAt.getTime() + elapsed * 1000),
        elapsedSec: elapsed, windowType: 'PRE_BASELINE',
        emgEnvelope: emgBase + Math.round(Math.random() * 4 - 2),
        temp: 36.2, heaterState: false, motorState: false,
        heater: false, motor: false, motorMode: 'OFF', motorSpeed: 0,
        isUserModification: false, modificationDirection: 'NONE', modificationTimestampSec: 0,
      });
    }
    // ACTIVE_THERAPY: 10 packets spread across 61–1140s
    const effect = sess.pilot.trialArm === 'ARM_HEAT_PULSE' ? -1.5 : sess.pilot.trialArm === 'ARM_HEAT_HARMONIC' ? -1.0 : -0.4;
    let modLogged = false;
    for (let i = 0; i < 10; i++) {
      const elapsed = 61 + i * 108;
      const emg = Math.max(5, emgBase + Math.round(effect * (i / 10) * 10 + Math.random() * 3 - 1.5));
      const isUserMod = !modLogged && i === 4 && Math.random() < 0.2;
      if (isUserMod) modLogged = true;
      readings.push({
        deviceId: 'PILOT-BELT-01', sessionId: sess.sessionId,
        receivedAt: new Date(sess.createdAt.getTime() + elapsed * 1000),
        elapsedSec: elapsed, windowType: 'ACTIVE_THERAPY',
        emgEnvelope: emg, temp: 36.5 + i * 0.25,
        heaterState: true, motorState: sess.pilot.trialArm !== 'ARM_HEAT_ONLY',
        heater: true, motor: sess.pilot.trialArm !== 'ARM_HEAT_ONLY',
        motorMode: sess.preset.vibrationMode,
        motorSpeed: sess.preset.vibrationSpeed,
        isUserModification: isUserMod,
        modificationDirection: isUserMod ? 'DECREASED_INTENSITY' : 'NONE',
        modificationTimestampSec: isUserMod ? elapsed : 0,
      });
    }
    // POST_BASELINE: 2 packets at 1145, 1195
    for (const elapsed of [1145, 1195]) {
      readings.push({
        deviceId: 'PILOT-BELT-01', sessionId: sess.sessionId,
        receivedAt: new Date(sess.createdAt.getTime() + elapsed * 1000),
        elapsedSec: elapsed, windowType: 'POST_BASELINE',
        emgEnvelope: Math.max(2, emgBase + Math.round(effect * 10 + Math.random() * 3 - 1.5)),
        temp: 39.0, heaterState: true, motorState: false,
        heater: true, motor: false, motorMode: 'OFF', motorSpeed: 0,
        isUserModification: false, modificationDirection: 'NONE', modificationTimestampSec: 0,
      });
    }
  }

  await SensorReading.insertMany(readings);
  console.log(`   Seeded ${sessions.length} pilot sessions, ${readings.length} sensor packets.\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  let memServer = null;
  let mongoUri  = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!mongoUri || FORCE_SEED) {
    const { MongoMemoryServer } = require('../backend/node_modules/mongodb-memory-server');
    memServer = await MongoMemoryServer.create();
    mongoUri  = memServer.getUri();
    console.log('📦  Using in-memory MongoDB for demo export.');
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('✅  Connected.\n');

  const logCount = await TherapyLog.countDocuments({ 'outcome.completionStatus': 'COMPLETED' });
  if (logCount === 0 || FORCE_SEED) await seedPilotData();

  // ── Query: COMPLETED sessions with primary outcome confirmed ───────────────
  // Pilot sessions: pilot.painPostConfirmed_15min = true
  // Legacy sessions: outcome.painPostConfirmed = true
  console.log('📋  Querying completed pilot sessions…');
  const logs = await TherapyLog.find({
    'outcome.completionStatus': 'COMPLETED',
    $or: [
      { 'pilot.painPostConfirmed_15min': true },
      { 'outcome.painPostConfirmed': true, 'pilot.trialArm': { $exists: false } },
    ],
  }).lean().exec();

  console.log(`   Found ${logs.length} qualifying sessions.\n`);
  if (!logs.length) { await mongoose.disconnect(); if (memServer) await memServer.stop(); return; }

  // ── Anonymise userId → participantId ───────────────────────────────────────
  const uidMap = new Map();
  let counter = 0;
  for (const log of logs) {
    const uid = String(log.userId);
    if (!uidMap.has(uid)) { counter++; uidMap.set(uid, `P${String(counter).padStart(3, '0')}`); }
    log._pid = log.pilot?.trialArm
      ? (log._pid = uidMap.get(uid))  // use pilot participantId if available in model
      : uidMap.get(uid);
    log._pid = uidMap.get(uid);
  }
  console.log(`   ${counter} unique participants anonymised.\n`);

  // ── Fetch sensor readings grouped by sessionId and windowType ──────────────
  const sessionIds = [...new Set(logs.map((l) => l.sessionId).filter(Boolean))];
  console.log(`📡  Fetching telemetry for ${sessionIds.length} sessions…`);
  const readings = await SensorReading.find({ sessionId: { $in: sessionIds } })
    .sort({ sessionId: 1, receivedAt: 1 }).lean().exec();
  console.log(`   ${readings.length} packets found.\n`);

  // Group by sessionId × windowType (with espTimestamp dedupe stopgap)
  const bySession = {};
  const seenTimestampsBySession = {};
  let dedupeCount = 0;

  for (const r of readings) {
    if (!r.sessionId) continue;
    if (!bySession[r.sessionId]) {
      bySession[r.sessionId] = { PRE_BASELINE: [], ACTIVE_THERAPY: [], POST_BASELINE: [], ALL: [] };
      seenTimestampsBySession[r.sessionId] = new Set();
    }

    // Stopgap: Deduplicate consecutive frames produced by 5Hz app polling over 2Hz BLE stream
    const espTs = r.espTimestamp || r.timestamp;
    if (espTs && espTs !== 0) {
      if (seenTimestampsBySession[r.sessionId].has(espTs)) {
        dedupeCount++;
        continue;
      }
      seenTimestampsBySession[r.sessionId].add(espTs);
    }

    const wt = r.windowType || 'ACTIVE_THERAPY';
    bySession[r.sessionId][wt].push(r);
    bySession[r.sessionId].ALL.push(r);
  }

  if (dedupeCount > 0) {
    console.log(`   ⚡ [Dedupe Stopgap] Filtered out ${dedupeCount} duplicate readings with matching espTimestamp.\n`);
  }

  // ── Build sessions.csv ─────────────────────────────────────────────────────
  console.log('🔨  Building sessions.csv…');
  const sessionRows = logs.map((log) => ({
    participantId:              log._pid,
    sessionId:                  log.sessionId ?? '',
    logId:                      String(log._id),
    createdAt:                  log.createdAt ? new Date(log.createdAt).toISOString() : '',
    // Arm allocation
    trialArm:                   log.pilot?.trialArm ?? '',
    sessionOrderForParticipant: log.pilot?.sessionOrderForParticipant ?? '',
    propensity:                 log.mlAudit?.propensity ?? '',
    settingSource:              log.mlAudit?.settingSource ?? '',
    wasClamped:                 log.mlAudit?.wasClamped ? 1 : 0,
    // Pre-session baseline
    painPre_tMinus5:            log.pilot?.painPre_tMinus5 ?? log.context?.painPre ?? '',
    painPre_t0:                 log.pilot?.painPre_t0 ?? '',
    painPre_baseline:           log.pilot?.painPre_baseline ?? log.context?.painPre ?? '',
    cycleDay:                   log.context?.cycleDay ?? '',
    tookMedication:             log.context?.tookMedication ? 1 : 0,
    posture:                    log.context?.posture ?? '',
    // PRIMARY OUTCOME
    painPost_15min:             log.pilot?.painPost_15min ?? '',
    painPostConfirmed_15min:    log.pilot?.painPostConfirmed_15min ? 1 : 0,
    deltaPain_15min:            log.pilot?.deltaPain_15min ?? '',
    // Secondary outcome
    painPost_0min:              log.outcome?.painPost ?? '',
    deltaPain_0min:             log.pilot?.deltaPain_0min ?? log.outcome?.deltaPain ?? '',
    // Adverse events (mandatory safety)
    adverseEvent:               log.pilot?.adverseEvent ? 1 : 0,
    adverseCategory:            log.pilot?.adverseCategory ?? 'NONE',
    adverseSeverity:            log.pilot?.adverseSeverity ?? 'NONE',
    earlyTermination:           log.pilot?.earlyTermination ? 1 : 0,
    earlyTerminationReason:     log.pilot?.earlyTerminationReason ?? 'NONE',
    // Device provenance
    firmwareVersion:            log.pilot?.firmwareVersion ?? '',
    appVersion:                 log.pilot?.appVersion ?? '',
    // Session feasibility
    actualDurationSeconds:      log.outcome?.actualDurationSeconds ?? '',
    completionStatus:           log.outcome?.completionStatus ?? '',
  }));

  // ── Build telemetry.csv ────────────────────────────────────────────────────
  console.log('🔨  Building telemetry.csv…');
  const telemetryRows = logs.map((log) => {
    const sid  = log.sessionId;
    const wins = sid ? (bySession[sid] ?? {}) : {};
    const pre  = wins.PRE_BASELINE   ?? [];
    const act  = wins.ACTIVE_THERAPY ?? [];
    const post = wins.POST_BASELINE  ?? [];
    const all  = wins.ALL            ?? [];

    const preEmg  = pre.map((r) => r.emgEnvelope ?? r.emg).filter((v) => v != null);
    const postEmg = post.map((r) => r.emgEnvelope ?? r.emg).filter((v) => v != null);
    const actEmg  = act.map((r) => r.emgEnvelope ?? r.emg).filter((v) => v != null);
    const actTemp = act.map((r) => r.temp).filter((v) => v != null);

    // Verify heaterState/motorState in baseline windows
    const preHeaterOff = pre.every((r) => r.heaterState === false || r.heater === false);
    const preMotorOff  = pre.every((r) => r.motorState  === false || r.motor  === false);
    const postMotorOff = post.every((r) => r.motorState  === false || r.motor  === false);

    // Modification events
    const mods   = all.filter((r) => r.isUserModification);
    const modLog = mods.map((r) => `${r.modificationDirection}@${r.modificationTimestampSec}s`).join(';');

    const preRms  = rms(preEmg);
    const postRms = rms(postEmg);

    return {
      participantId:              log._pid,
      sessionId:                  sid ?? '',
      trialArm:                   log.pilot?.trialArm ?? '',
      sessionOrderForParticipant: log.pilot?.sessionOrderForParticipant ?? '',
      propensity:                 log.mlAudit?.propensity ?? '',
      // Window packet counts
      pre_packet_count:           pre.length,
      active_packet_count:        act.length,
      post_packet_count:          post.length,
      total_packet_count:         all.length,
      // Baseline integrity flags
      pre_heaterState_allOff:     preHeaterOff ? 1 : 0,
      pre_motorState_allOff:      preMotorOff  ? 1 : 0,
      post_motorState_allOff:     postMotorOff ? 1 : 0,
      // PRE_BASELINE EMG (clean resting — motor+heater OFF)
      emg_pre_mean:               mean(preEmg),
      emg_pre_rms:                preRms,
      emg_pre_max:                maxVal(preEmg),
      // POST_BASELINE EMG (clean post-Rx — motor OFF)
      emg_post_mean:              mean(postEmg),
      emg_post_rms:               postRms,
      emg_post_max:               maxVal(postEmg),
      // EMG change score (exploratory)
      delta_emg_clean_rms:        (preRms != null && postRms != null) ? r2(preRms - postRms) : null,
      // ACTIVE_THERAPY EMG and temp (may include vibration artifact)
      emg_active_mean:            mean(actEmg),
      emg_active_slope:           slope(actEmg),
      temp_active_mean:           mean(actTemp),
      temp_active_max:            maxVal(actTemp),
      // Participant modifications
      modification_count:         mods.length,
      modification_log:           modLog || 'NONE',
      // Telemetry quality
      telemetry_packet_loss_pct:  log.pilot?.telemetry_packet_loss_pct ?? '',
      // Outcome (for convenience in analysis scripts)
      deltaPain_15min:            log.pilot?.deltaPain_15min ?? '',
    };
  });

  // ── Write CSVs ────────────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const sessPath  = path.join(OUT_DIR, 'sessions.csv');
  const telePath  = path.join(OUT_DIR, 'telemetry.csv');
  const mapPath   = path.join(OUT_DIR, 'participant_map.json');

  fs.writeFileSync(sessPath, toCsv(sessionRows), 'utf-8');
  fs.writeFileSync(telePath, toCsv(telemetryRows), 'utf-8');
  fs.writeFileSync(mapPath,  JSON.stringify(Object.fromEntries(uidMap), null, 2), 'utf-8');

  console.log(`\n✅  Export complete:`);
  console.log(`   sessions.csv   → ${sessPath}  (${sessionRows.length} rows)`);
  console.log(`   telemetry.csv  → ${telePath}  (${telemetryRows.length} rows)`);
  console.log(`   participant_map.json → ${mapPath}  ⚠️  CONFIDENTIAL — never share`);

  // ── Preview first 3 rows ──────────────────────────────────────────────────
  if (sessionRows.length) {
    console.log('\n── sessions.csv preview (first 3 rows) ──');
    const cols = ['participantId','trialArm','propensity','painPre_baseline','painPost_15min','deltaPain_15min','adverseEvent','adverseCategory'];
    console.log(cols.join('\t'));
    sessionRows.slice(0, 3).forEach((r) => console.log(cols.map((c) => r[c] ?? '').join('\t')));
  }
  if (telemetryRows.length) {
    console.log('\n── telemetry.csv preview (first 3 rows) ──');
    const cols = ['participantId','trialArm','pre_packet_count','emg_pre_rms','emg_post_rms','delta_emg_clean_rms','modification_count','modification_log'];
    console.log(cols.join('\t'));
    telemetryRows.slice(0, 3).forEach((r) => console.log(cols.map((c) => r[c] ?? '').join('\t')));
  }

  await mongoose.disconnect();
  if (memServer) await memServer.stop();
  console.log('\n🔌  Done.\n');
}

main().catch((err) => { console.error('❌  Export failed:', err.message); process.exit(1); });
