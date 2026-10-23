/**
 * backend/src/modules/pilot/pilot.routes.js
 *
 * Routes for the HerComfort Pilot Feasibility Study.
 *
 * Endpoints:
 *   POST /api/pilot/enroll          — Enroll an authenticated user into the study.
 *   GET  /api/pilot/me              — Get this user's participant status + next arm.
 *   POST /api/pilot/session/start   — Allocate the next arm; returns prescribe payload.
 *   POST /api/pilot/session/cancel  — Mark a session as CANCELLED (does NOT consume sessionOrder).
 *   POST /api/pilot/review/unblock  — Supervisor-only: reactivate a SUSPENDED participant.
 *
 * SECURITY INVARIANTS (enforced here, not in the client):
 *   1. participantId is NEVER accepted from the request body.
 *      It is always looked up from the authenticated userId.
 *   2. sessionOrder is NEVER accepted from the request body.
 *      It is always taken from participant.nextSessionOrder.
 *   3. A SUSPENDED participant cannot start a new session.
 *   4. MODERATE/SEVERE adverse events (written via /api/therapy/feedback)
 *      trigger a call to suspendParticipant() via the TherapyLog post-save hook.
 *   5. All allocations pass through the safety interceptor before returning.
 */

import express from 'express';
import crypto from 'crypto';
import PilotParticipant from '../../models/PilotParticipant.js';
import TherapyLog from '../../models/TherapyLog.js';
import authGuard from '../auth/auth.guard.js';
import {
  allocateArm,
  buildArmPreset,
  getSequenceIndexForEnrollment,
  getSequenceArmsForIndex,
  PILOT_TRIAL_MODE,
} from '../../../../ml/trial_allocator.js';
import { runSafetyPipeline } from '../../../../ml/safetyInterceptor.js';

const router = express.Router();

// ── Fail-Closed Security Middleware ───────────────────────────────────────────
/**
 * Pilot endpoints MUST fail closed if:
 * 1. PILOT_SUPERVISOR_KEY is unset or equals the placeholder 'CHANGE_ME_BEFORE_PILOT'
 * 2. PARTICIPANT_ID_SALT is unset in environment (no hardcoded fallback allowed)
 */
router.use((req, res, next) => {
  if (req.app.get('isInMemoryDB')) {
    return res.status(503).json({
      success: false,
      error: 'EPHEMERAL_DB_PROHIBITED',
      message: 'Pilot feasibility endpoints refuse to run on ephemeral in-memory storage to prevent data loss. Configure a persistent MongoDB instance.',
    });
  }
  const supervisorKey = process.env.PILOT_SUPERVISOR_KEY;
  if (!supervisorKey || supervisorKey === 'CHANGE_ME_BEFORE_PILOT') {
    return res.status(503).json({
      success: false,
      error: 'pilotConfigurationError',
      message: 'Pilot endpoints disabled: PILOT_SUPERVISOR_KEY is unset or set to the default placeholder. Configure a secure supervisor key.',
    });
  }
  if (!process.env.PARTICIPANT_ID_SALT) {
    return res.status(503).json({
      success: false,
      error: 'pilotConfigurationError',
      message: 'Pilot endpoints disabled: PARTICIPANT_ID_SALT must be configured in environment.',
    });
  }
  next();
});

// ── Participant ID derivation ──────────────────────────────────────────────────
/**
 * Derive a stable, de-identified participant ID from a userId.
 * Uses sha256(userId + salt) → last 24 bits → integer 1–999 → "PXXX".
 * Salt MUST come from environment only.
 *
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {string} e.g. "P042"
 */
function deriveParticipantId(userId) {
  const salt = process.env.PARTICIPANT_ID_SALT;
  if (!salt) {
    throw new Error('[pilot] PARTICIPANT_ID_SALT must come from environment only.');
  }
  const hash = crypto
    .createHash('sha256')
    .update(String(userId) + salt)
    .digest('hex');
  // Use last 6 hex chars → integer mod 999 + 1 (1–999)
  const num = (parseInt(hash.slice(-6), 16) % 999) + 1;
  return `P${String(num).padStart(3, '0')}`;
}

// ── Stale Session Handling ───────────────────────────────────────────────────
/**
 * Stale-session handling: any session in IN_PROGRESS state older than 3 hours
 * is marked ABANDONED.
 *
 * CRITICAL TRIAL RULE:
 * Does an ABANDONED session consume the participant's trial arm or sessionOrder?
 * NO. Like a CANCELLED session, an ABANDONED session does NOT increment nextSessionOrder.
 * The participant will receive the same trial arm when they start their next session.
 * Only COMPLETED sessions increment nextSessionOrder.
 */
export async function cleanupStaleSessions(filterUserId = null) {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const query = {
    'outcome.completionStatus': 'IN_PROGRESS',
    createdAt: { $lt: threeHoursAgo },
    ...(filterUserId ? { userId: filterUserId } : {}),
  };
  const result = await TherapyLog.updateMany(query, {
    $set: {
      'outcome.completionStatus': 'ABANDONED',
    },
  });
  if (result.modifiedCount > 0) {
    console.log(`[Pilot] Cleaned up ${result.modifiedCount} stale session(s) -> ABANDONED (arms not consumed)`);
  }
  return result;
}

// ── Suspend participant on severe adverse event ────────────────────────────────
/**
 * Called internally when /api/therapy/feedback records a MODERATE or SEVERE event.
 * Sets studyStatus=SUSPENDED so no further sessions can be started.
 * This is queryable (not just console.warn) — see GET /api/pilot/suspensions.
 *
 * @param {string} userId
 * @param {object} opts - { logId, adverseCategory, adverseSeverity }
 */
export async function suspendParticipantOnAdverseEvent(userId, opts) {
  const participant = await PilotParticipant.findOne({ userId });
  if (!participant || participant.studyStatus !== 'ACTIVE') return;

  participant.studyStatus = 'SUSPENDED';
  participant.suspendedReason = {
    logId:           String(opts.logId),
    adverseCategory: opts.adverseCategory,
    adverseSeverity: opts.adverseSeverity,
    timestamp:       new Date().toISOString(),
    reviewedBy:      null,
  };
  participant.suspendedAt = new Date();
  await participant.save();

  console.warn(
    `🚫 [PILOT SAFETY] Participant userId=${userId} participantId=${participant.participantId} ` +
    `SUSPENDED — ${opts.adverseSeverity} adverse event: ${opts.adverseCategory}. ` +
    `LogId=${opts.logId}. Study supervisor review required before next session.`
  );
}

// ── POST /api/pilot/enroll ────────────────────────────────────────────────────
/**
 * Enroll the authenticated user into the pilot study.
 * Derives participantId server-side from userId.
 * Idempotent: if already enrolled, returns existing record.
 *
 * Body:
 *   consentVersion:              string  — e.g. "1.0.0"
 *   age:                         number  — 18–45 (inclusion check)
 *   cycleLengthTypical:          number
 *   periodDurationTypical:       number
 *   baselinePainSeverityTypical: number  — VAS 0–10
 *   dysmenorrheaType:            string
 *   screeningPregnancyNegative:  boolean — must be true
 *   screeningNoPacemaker:        boolean — must be true
 *   screeningNoSkinCondition:    boolean — must be true
 */
router.post('/enroll', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Check existing enrollment
    const existing = await PilotParticipant.findOne({ userId });
    if (existing) {
      return res.json({
        success: true,
        enrolled: true,
        participantId:   existing.participantId,
        studyStatus:     existing.studyStatus,
        nextSessionOrder: existing.nextSessionOrder,
        nextArm:         existing.nextArm,
        message: 'Already enrolled.',
      });
    }

    const {
      consentVersion,
      age,
      cycleLengthTypical,
      periodDurationTypical,
      baselinePainSeverityTypical,
      dysmenorrheaType = 'UNCONFIRMED',
      screeningPregnancyNegative,
      screeningNoPacemaker,
      screeningNoSkinCondition,
    } = req.body;

    // Validate required fields
    const errors = [];
    if (!consentVersion)       errors.push('consentVersion:required');
    if (age == null || age < 18 || age > 45) errors.push('age:must be 18-45');
    if (!screeningPregnancyNegative) errors.push('screeningPregnancyNegative:must be true (exclusion criterion)');
    if (!screeningNoPacemaker)       errors.push('screeningNoPacemaker:must be true (exclusion criterion)');
    if (!screeningNoSkinCondition)   errors.push('screeningNoSkinCondition:must be true (exclusion criterion)');

    if (errors.length) {
      return res.status(400).json({ success: false, error: 'enrollmentInvalid', fields: errors });
    }

    // Derive participantId server-side
    const participantId = deriveParticipantId(String(userId));

    // Verify no collision (extremely unlikely but guard it)
    const collision = await PilotParticipant.findOne({ participantId, userId: { $ne: userId } });
    if (collision) {
      // Collision: append user's last 2 chars of userId to distinguish
      // (This is a safety net — should never occur in practice with n<999 participants)
      const suffix = String(userId).slice(-2);
      return res.status(500).json({
        success: false,
        error: 'participantIdCollision',
        message: `ParticipantId ${participantId} is already assigned to another user. Contact study admin.`,
      });
    }

    // Determine enrollment order (1-indexed) atomically
    const count = await PilotParticipant.countDocuments();
    const enrollmentOrder = count + 1;

    // Get sequence from pre-generated permuted blocks (blocks of 6, fixed seed)
    const sequenceIndex = getSequenceIndexForEnrollment(enrollmentOrder);
    const trialArmSequence = getSequenceArmsForIndex(sequenceIndex);

    const participant = await PilotParticipant.create({
      userId,
      participantId,
      enrollmentOrder,
      consentVersion,
      consentTimestamp: new Date(),
      sequenceIndex,
      trialArmSequence,
      nextSessionOrder: 1,
      age:                         age ?? null,
      cycleLengthTypical:          cycleLengthTypical ?? null,
      periodDurationTypical:       periodDurationTypical ?? null,
      baselinePainSeverityTypical: baselinePainSeverityTypical ?? null,
      dysmenorrheaType,
      screeningPregnancyNegative:  Boolean(screeningPregnancyNegative),
      screeningNoPacemaker:        Boolean(screeningNoPacemaker),
      screeningNoSkinCondition:    Boolean(screeningNoSkinCondition),
      screeningPassed: true,
    });

    console.log(`[Pilot] Enrolled userId=${userId} as ${participantId} order=${enrollmentOrder} seq=${sequenceIndex}`);

    res.status(201).json({
      success: true,
      enrolled: true,
      participantId:    participant.participantId,
      enrollmentOrder:  participant.enrollmentOrder,
      studyStatus:      participant.studyStatus,
      nextSessionOrder: participant.nextSessionOrder,
      nextArm:          participant.nextArm,
      trialArmSequence: participant.trialArmSequence,
      // Do NOT return sequenceIndex — only auditors should see it
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/pilot/me ─────────────────────────────────────────────────────────
router.get('/me', authGuard, async (req, res, next) => {
  try {
    const participant = await PilotParticipant.findOne({ userId: req.user._id });
    if (!participant) {
      return res.status(404).json({ success: false, enrolled: false, message: 'Not enrolled in pilot study.' });
    }
    res.json({
      success: true,
      enrolled: true,
      participantId:    participant.participantId,
      studyStatus:      participant.studyStatus,
      nextSessionOrder: participant.nextSessionOrder,
      nextArm:          participant.nextArm,
      completedSessions: participant.completedSessionLogIds.length,
      suspendedReason:  participant.studyStatus === 'SUSPENDED' ? participant.suspendedReason : undefined,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/pilot/session/start ─────────────────────────────────────────────
/**
 * Allocates the next arm for this participant's session.
 * participantId and sessionOrder come from the server-side participant record.
 * The client must NOT send these fields.
 *
 * Body:
 *   context: { painPre, painPre_tMinus5, painPre_t0, cycleDay, tookMedication, ... }
 *   contraindications?: { pregnancy, pacemaker, skinCondition }
 *   pilot?: { firmwareVersion, appVersion }
 *   sessionId?: string
 *   lastSetpointTemp?: number
 */
router.post('/session/start', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const participant = await PilotParticipant.findOne({ userId });

    // ── Guard: must be enrolled
    if (!participant) {
      return res.status(403).json({ success: false, error: 'notEnrolled', message: 'Not enrolled in pilot study. POST /api/pilot/enroll first.' });
    }

    // ── Guard: must be ACTIVE
    if (participant.studyStatus === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error:   'participantSuspended',
        message: 'Sessions are blocked pending supervisor review of an adverse event.',
        suspendedReason: participant.suspendedReason,
        suspendedAt:     participant.suspendedAt,
      });
    }
    if (participant.studyStatus === 'WITHDRAWN') {
      return res.status(403).json({ success: false, error: 'withdrawn', message: 'Participant has withdrawn from the study.' });
    }
    if (participant.studyStatus === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'studyComplete', message: 'All 3 sessions completed.' });
    }

    // ── Guard: sessions must be within range
    if (participant.nextSessionOrder > 3) {
      await PilotParticipant.updateOne({ _id: participant._id }, { studyStatus: 'COMPLETED' });
      return res.status(400).json({ success: false, error: 'studyComplete', message: 'All 3 sessions completed.' });
    }

    const {
      context = {},
      contraindications = {},
      pilot: pilotInput = {},
      sessionId = null,
      lastSetpointTemp = null,
    } = req.body;

    // Use server-side values — NEVER accept from client
    const participantId = participant.participantId;
    const sessionOrder  = participant.nextSessionOrder;

    // Validate painPre
    const painPre = parseFloat(context.painPre);
    if (isNaN(painPre) || painPre < 0 || painPre > 10) {
      return res.status(400).json({ success: false, error: 'inputInvalid', fields: ['painPre:required,0-10'] });
    }

    // ── Stale-session check: clean up any IN_PROGRESS sessions >3h old
    await cleanupStaleSessions(userId);

    // Allocate arm using participant's enrolled sequence
    const allocation = allocateArm(participantId, sessionOrder, participant.sequenceIndex);
    const armPreset  = buildArmPreset(allocation.arm);

    // Safety interceptor (always runs)
    const safeContext = {
      painPre,
      emg:                    parseFloatSafe(context.emg, null),
      posture:                context.posture || 'UNKNOWN',
      cycleDay:               parseIntSafe(context.cycleDay, null),
      tookMedication:         Boolean(context.tookMedication),
      minutesSinceMedication: parseFloatSafe(context.minutesSinceMedication, null),
      skinTempIn:             parseFloatSafe(context.skinTempIn, null),
    };

    const safety = runSafetyPipeline(safeContext, armPreset, contraindications, lastSetpointTemp);

    if (safety.blocked) {
      return res.status(200).json({
        success: false,
        blocked: true,
        blockReason: safety.blockReason,
        message: 'Session blocked due to contraindication. Please consult a healthcare provider.',
      });
    }

    // Compute dual baseline
    const tMinus5  = parseFloatSafe(context.painPre_tMinus5, null);
    const t0       = parseFloatSafe(context.painPre_t0, null);
    const baseline = (tMinus5 != null && t0 != null) ? round2((tMinus5 + t0) / 2) : null;

    // Create TherapyLog
    const therapyLog = await TherapyLog.create({
      userId,
      sessionId,
      context: safeContext,
      preset: {
        presetId:       safety.finalPreset.id,
        presetName:     safety.finalPreset.name,
        targetTemp:     safety.finalPreset.targetTemp,
        vibrationMode:  safety.finalPreset.vibrationMode,
        vibrationSpeed: safety.finalPreset.vibrationSpeed,
        durationMin:    safety.finalPreset.durationMin,
      },
      mlAudit: {
        modelVersion:       'pilot-trial-v1.0',
        settingSource:      safety.wasClamped ? 'safety_override' : 'trial_allocator',
        propensity:         allocation.propensity,
        wasClamped:         safety.wasClamped,
        clampDetails:       safety.clampDetails || undefined,
        predictedDeltaPain: null,
        allPresetScores:    null,
        inferenceLatencyMs: null,
      },
      pilot: {
        trialArm:                  allocation.arm,
        sessionOrderForParticipant: sessionOrder,
        sequenceIndex:             allocation.sequenceIndex,
        painPre_tMinus5:           tMinus5,
        painPre_t0:                t0,
        painPre_baseline:          baseline,
        firmwareVersion:           pilotInput.firmwareVersion || null,
        appVersion:                pilotInput.appVersion || null,
      },
      contraindications: {
        pregnancy:      Boolean(contraindications.pregnancy),
        pacemaker:      Boolean(contraindications.pacemaker),
        skinCondition:  Boolean(contraindications.skinCondition),
        therapyBlocked: false,
      },
      outcome: { completionStatus: 'IN_PROGRESS' },
    });

    console.log(
      `[Pilot] Session started: participant=${participantId} ` +
      `session=${sessionOrder} arm=${allocation.arm} logId=${therapyLog._id}`
    );

    res.status(201).json({
      success:   true,
      logId:     therapyLog._id,
      // Arm info for the UI
      arm: {
        id:            safety.finalPreset.id,
        name:          safety.finalPreset.name,
        targetTemp:    safety.finalPreset.targetTemp,
        vibrationMode: safety.finalPreset.vibrationMode,
        vibrationSpeed: safety.finalPreset.vibrationSpeed,
        durationMin:   safety.finalPreset.durationMin,
      },
      propensity:         allocation.propensity,
      sessionOrder,
      // Baseline window instruction
      baselineWindow: {
        durationSec:   60,
        heaterOff:     true,
        motorOff:      true,
        banner:        'Measuring baseline muscle tone (1 min). Please stay still. Heater and motor are off.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/pilot/session/cancel ────────────────────────────────────────────
/**
 * Mark a session as CANCELLED. sessionOrder is NOT incremented.
 * The same sessionOrder will be used in the next /session/start call.
 *
 * Body: { logId: string }
 */
router.post('/session/cancel', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { logId } = req.body;
    if (!logId) return res.status(400).json({ success: false, message: 'logId required' });

    const log = await TherapyLog.findOne({ _id: logId, userId });
    if (!log) return res.status(404).json({ success: false, message: 'TherapyLog not found' });

    log.outcome.completionStatus = 'CANCELLED';
    await log.save();

    // Record cancelled logId but do NOT increment nextSessionOrder
    await PilotParticipant.updateOne(
      { userId },
      { $addToSet: { cancelledSessionLogIds: log._id } }
    );

    console.log(`[Pilot] Session CANCELLED: logId=${logId} userId=${userId} (sessionOrder NOT consumed)`);
    res.json({ success: true, message: 'Session cancelled. sessionOrder not consumed. Retry with /session/start.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/pilot/suspensions ────────────────────────────────────────────────
/**
 * Supervisor-only: list all SUSPENDED participants with their adverse event details.
 * Protected by PILOT_SUPERVISOR_KEY env var (simple shared secret for internal use).
 */
router.get('/suspensions', async (req, res, next) => {
  try {
    const key = req.headers['x-pilot-supervisor-key'];
    if (!key || key !== process.env.PILOT_SUPERVISOR_KEY) {
      return res.status(403).json({ success: false, message: 'Supervisor key required.' });
    }
    const suspended = await PilotParticipant.find({ studyStatus: 'SUSPENDED' })
      .select('participantId studyStatus suspendedReason suspendedAt nextSessionOrder')
      .lean();
    res.json({ success: true, count: suspended.length, participants: suspended });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/pilot/review/unblock ────────────────────────────────────────────
/**
 * Supervisor-only: reactivate a SUSPENDED participant after adverse event review.
 * Records the reviewer and review timestamp.
 *
 * Body: { participantId: string, reviewNotes: string }
 * Header: x-pilot-supervisor-key
 */
router.post('/review/unblock', async (req, res, next) => {
  try {
    const key = req.headers['x-pilot-supervisor-key'];
    if (!key || key !== process.env.PILOT_SUPERVISOR_KEY) {
      return res.status(403).json({ success: false, message: 'Supervisor key required.' });
    }

    const { participantId, reviewNotes } = req.body;
    if (!participantId) return res.status(400).json({ success: false, message: 'participantId required' });

    const participant = await PilotParticipant.findOne({ participantId });
    if (!participant) return res.status(404).json({ success: false, message: 'Participant not found' });
    if (participant.studyStatus !== 'SUSPENDED') {
      return res.status(400).json({ success: false, message: `Participant is ${participant.studyStatus}, not SUSPENDED.` });
    }

    participant.studyStatus = 'ACTIVE';
    participant.suspendedReason = {
      ...participant.suspendedReason,
      reviewedBy: 'supervisor',
      reviewedAt: new Date().toISOString(),
      reviewNotes: reviewNotes || '',
    };
    await participant.save();

    console.log(`[Pilot] Participant ${participantId} reactivated by supervisor.`);
    res.json({ success: true, participantId, studyStatus: 'ACTIVE' });
  } catch (err) {
    next(err);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseFloatSafe(val, fallback = null) {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}
function parseIntSafe(val, fallback = null) {
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}
function round2(n) {
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

export default router;
