import express from 'express';
import { prescribe, ruleBasedPreset, getModelStatus } from '../../../../ml/scorer.js';
import { runSafetyPipeline } from '../../../../ml/safetyInterceptor.js';
import { SAFE_DEFAULT_PRESET } from '../../../../ml/presets.js';
import { PILOT_TRIAL_MODE } from '../../../../ml/trial_allocator.js';
import { suspendParticipantOnAdverseEvent } from '../pilot/pilot.routes.js';
import TherapyLog from '../../models/TherapyLog.js';
import authGuard from '../auth/auth.guard.js';

const router = express.Router();

// ─── GET /api/therapy/status ───────────────────────────────────────────────────
// Returns current model status (version, type, loaded or rule-based fallback)
router.get('/status', (req, res) => {
  res.json({ success: true, model: getModelStatus() });
});

// ─── POST /api/therapy/prescribe ──────────────────────────────────────────────
/**
 * Full AI prescription pipeline:
 *   1. Validate & sanitize inputs
 *   2. Run ML scorer (PILOT_TRIAL_MODE → trial_allocator; else rule-based/ML)
 *   3. Run safety interceptor (clamp, contraindication check, slew rate)
 *   4. Log to TherapyLog with full mlAudit + pilot block
 *   5. Return prescription + rule-based comparison
 *
 * Body (all sessions):
 *   context: { painPre, emg?, posture?, cycleDay?, stress?, fatigue?,
 *               tookMedication?, minutesSinceMedication?, skinTempIn? }
 *   contraindications?: { pregnancy?, pacemaker?, skinCondition? }
 *   lastSetpointTemp?: number
 *   sessionId?: string
 *
 * Additional body fields for PILOT_TRIAL_MODE=true [MUST]:
 *   participantId: string         — de-identified ID (e.g. "P001")
 *   sessionOrder: number          — 1, 2, or 3 (this participant's Nth session)
 *   pilot: {
 *     painPre_tMinus5: number    — pain at T-5 min (VAS 0–10)
 *     painPre_t0: number         — pain at session start tap (VAS 0–10)
 *     firmwareVersion: string
 *     appVersion: string
 *   }
 */
router.post('/prescribe', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      context = {},
      contraindications = {},
      lastSetpointTemp = null,
      sessionId = null,
      // Pilot trial fields (required when PILOT_TRIAL_MODE=true)
      participantId = null,
      sessionOrder = null,
      pilot: pilotInput = {},
    } = req.body;

    // ── Pilot trial mode validation ──────────────────────────────────────────
    let pilotSequenceIndex = null;
    if (PILOT_TRIAL_MODE) {
      if (!participantId) {
        return res.status(400).json({
          success: false,
          error: 'pilotFieldMissing',
          message: 'PILOT_TRIAL_MODE is active. participantId is required in request body.',
        });
      }
      if (!sessionOrder || sessionOrder < 1 || sessionOrder > 3) {
        return res.status(400).json({
          success: false,
          error: 'pilotFieldMissing',
          message: 'PILOT_TRIAL_MODE is active. sessionOrder (1, 2, or 3) is required.',
        });
      }

      // Check if participant is SUSPENDED, WITHDRAWN, or COMPLETED
      const { default: PilotParticipant } = await import('../../models/PilotParticipant.js');
      const participant = await PilotParticipant.findOne({
        $or: [{ userId }, { participantId }],
      });
      if (participant) {
        pilotSequenceIndex = participant.sequenceIndex;
        if (participant.studyStatus === 'SUSPENDED') {
          return res.status(403).json({
            success: false,
            error: 'participantSuspended',
            message: 'Prescriptions are blocked pending supervisor review of an adverse event.',
            suspendedReason: participant.suspendedReason,
          });
        }
        if (participant.studyStatus === 'WITHDRAWN') {
          return res.status(403).json({
            success: false,
            error: 'withdrawn',
            message: 'Participant has withdrawn from the study.',
          });
        }
        if (participant.studyStatus === 'COMPLETED' || participant.nextSessionOrder > 3) {
          return res.status(400).json({
            success: false,
            error: 'studyComplete',
            message: 'All 3 sessions completed.',
          });
        }
      }
    }

    // ── 1. Strict input validation (Fix 1) ──────────────────────────────────
    // Non-numeric context fields are rejected with HTTP 400.
    // painPre is required and must be 0–10.
    // Optional numeric fields fall back to null (no silent defaults).
    const validationErrors = validateContextInputs(context);
    if (validationErrors.length > 0) {
      console.warn('[therapy] inputInvalid:', validationErrors);
      return res.status(400).json({
        success: false,
        error: 'inputInvalid',
        fields: validationErrors,
        message: `Invalid context fields: ${validationErrors.join(', ')}. Fix the values and retry.`,
        // Return the safe fallback preset so the client can still display something
        safeFallbackPreset: SAFE_DEFAULT_PRESET,
      });
    }

    const safeContext = {
      painPre:                 parseFloatSafe(context.painPre),          // required, validated above
      emg:                     parseFloatSafe(context.emg, null),        // null = not available
      posture:                 context.posture || 'UNKNOWN',
      cycleDay:                parseIntSafe(context.cycleDay, null),
      stress:                  parseFloatSafe(context.stress, null),
      fatigue:                 parseFloatSafe(context.fatigue, null),
      tookMedication:          Boolean(context.tookMedication),
      minutesSinceMedication:  parseFloatSafe(context.minutesSinceMedication, null),
      skinTempIn:              parseFloatSafe(context.skinTempIn, null),
    };

    // ── 2. ML Scorer / Pilot Trial Allocator ─────────────────────────────────
    // PILOT_TRIAL_MODE=true → prescribe() routes through trial_allocator.js.
    //   participantId + sessionOrder are required in that path.
    // PILOT_TRIAL_MODE=false → epsilon-greedy or rule-based (existing logic).
    const mlResult = prescribe(safeContext, {
      explorationEpsilon: 0.0, // kept 0 during cold-start; trial mode ignores this
      participantId,           // passed through; only used when PILOT_TRIAL_MODE=true
      sessionOrder: sessionOrder ? parseInt(sessionOrder, 10) : null,
      sequenceIndex: pilotSequenceIndex,
    });

    // ── 3. Rule-based comparison (for UI side-by-side display) ───────────────
    const ruleBasedResult = ruleBasedPreset(safeContext);

    // ── 4. Safety Interceptor ────────────────────────────────────────────────
    const safety = runSafetyPipeline(
      safeContext,
      mlResult.preset || SAFE_DEFAULT_PRESET,
      contraindications,
      lastSetpointTemp
    );

    // If therapy is contraindicated, block and return
    if (safety.blocked) {
      return res.status(200).json({
        success: false,
        blocked: true,
        blockReason: safety.blockReason,
        message: 'Therapy blocked due to contraindication. Please consult a healthcare provider.',
      });
    }

    // Merge setting source: safety override takes priority
    const finalSettingSource = safety.wasClamped
      ? 'safety_override'
      : mlResult.settingSource;

    // ── 5. Save TherapyLog ───────────────────────────────────────────────────
    // Build pilot subdocument (null for all fields in non-pilot sessions)
    const pilotDoc = PILOT_TRIAL_MODE ? {
      trialArm:                  mlResult.trialArm,
      sessionOrderForParticipant: parseInt(sessionOrder, 10),
      sequenceIndex:             mlResult.sequenceIndex,
      painPre_tMinus5:           parseFloatSafe(pilotInput.painPre_tMinus5, null),
      painPre_t0:                parseFloatSafe(pilotInput.painPre_t0, null),
      painPre_baseline: (
        pilotInput.painPre_tMinus5 != null && pilotInput.painPre_t0 != null
          ? round2((parseFloat(pilotInput.painPre_tMinus5) + parseFloat(pilotInput.painPre_t0)) / 2)
          : null
      ),
      firmwareVersion:           pilotInput.firmwareVersion || null,
      appVersion:                pilotInput.appVersion || null,
    } : undefined;

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
        modelVersion:       mlResult.modelVersion,
        settingSource:      finalSettingSource,
        propensity:         mlResult.propensity,
        wasClamped:         safety.wasClamped,
        clampDetails:       safety.clampDetails || undefined,
        predictedDeltaPain: mlResult.predictedDeltaPain,
        allPresetScores:    mlResult.allPresetScores,
        inferenceLatencyMs: mlResult.inferenceLatencyMs,
      },
      pilot: pilotDoc,
      contraindications: {
        pregnancy:      Boolean(contraindications.pregnancy),
        pacemaker:      Boolean(contraindications.pacemaker),
        skinCondition:  Boolean(contraindications.skinCondition),
        therapyBlocked: false,
      },
      outcome: {
        completionStatus: 'IN_PROGRESS',
      },
    });

    // ── 6. Response ──────────────────────────────────────────────────────────
    res.json({
      success: true,
      logId: therapyLog._id,

      // The AI recommendation (post-safety)
      aiPrescription: {
        presetId:       safety.finalPreset.id,
        presetName:     safety.finalPreset.name,
        targetTemp:     safety.finalPreset.targetTemp,
        vibrationMode:  safety.finalPreset.vibrationMode,
        vibrationSpeed: safety.finalPreset.vibrationSpeed,
        durationMin:    safety.finalPreset.durationMin,
        description:    safety.finalPreset.description,
      },

      // The rule-based result (for side-by-side comparison in UI)
      ruleBasedPrescription: {
        presetId:       ruleBasedResult.id,
        presetName:     ruleBasedResult.name,
        targetTemp:     ruleBasedResult.targetTemp,
        vibrationMode:  ruleBasedResult.vibrationMode,
        vibrationSpeed: ruleBasedResult.vibrationSpeed,
        durationMin:    ruleBasedResult.durationMin,
        description:    ruleBasedResult.description,
      },

      // ML audit info for transparency
      audit: {
        modelVersion:       mlResult.modelVersion,
        settingSource:      finalSettingSource,
        propensity:         mlResult.propensity,
        wasClamped:         safety.wasClamped,
        predictedDeltaPain: mlResult.predictedDeltaPain,
        inferenceLatencyMs: mlResult.inferenceLatencyMs,
        isModelLoaded:      mlResult.isModelLoaded,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/therapy/feedback ───────────────────────────────────────────────
/**
 * Records the post-session outcome (painPost, deltaPain, completion status).
 * This is the critical closed-loop signal for future model training.
 *
 * Body (all sessions):
 *   logId:                 string  (TherapyLog _id from /prescribe response)
 *   painPost:              number  (0–10, VAS scale, immediate post-session)
 *   actualDurationSeconds: number
 *   completionStatus:      'COMPLETED' | 'CANCELLED'
 *   settingSource:         'ml_recommendation' | 'user_manual'
 *   painPostConfirmed:     boolean (explicit slider tap)
 *   sessionId:             string
 *
 * Additional body fields for pilot sessions [MUST]:
 *   pilot: {
 *     painPost_15min:          number   — PRIMARY OUTCOME (VAS at T+15 min)
 *     painPostConfirmed_15min: boolean  — explicit tap required
 *     adverseEvent:            boolean  — MANDATORY on every pilot session
 *     adverseCategory:         string   — 'NONE' | 'MILD_ERYTHEMA' | ...
 *     adverseSeverity:         string   — 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'
 *     earlyTermination:        boolean
 *     earlyTerminationReason:  string
 *     emg_pre_rms:             number   — computed from SensorReading at session end
 *     emg_pre_mean:            number
 *     emg_post_rms:            number
 *     emg_post_mean:           number
 *     delta_emg_clean_rms:     number
 *     telemetry_packet_count:  number
 *     telemetry_packet_loss_pct: number
 *   }
 */
router.post('/feedback', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      logId,
      painPost,
      actualDurationSeconds,
      completionStatus = 'COMPLETED',
      settingSource,
      painPostConfirmed = false,
      sessionId,
      // Pilot fields (optional; non-pilot sessions ignore these)
      pilot: pilotFeedback = {},
    } = req.body;

    if (!logId) {
      return res.status(400).json({ success: false, message: 'logId is required' });
    }

    const log = await TherapyLog.findOne({ _id: logId, userId });
    if (!log) {
      return res.status(404).json({ success: false, message: 'TherapyLog not found' });
    }

    const painPre   = log.context.painPre;
    const deltaPain = painPost != null ? round2(painPre - painPost) : null;

    // Link sessionId if not already set or updated
    if (sessionId && (!log.sessionId || log.sessionId !== sessionId)) {
      log.sessionId = sessionId;
    }

    // ── Standard outcome ─────────────────────────────────────────────────────
    log.outcome.painPost              = painPost;
    log.outcome.deltaPain             = deltaPain;
    log.outcome.actualDurationSeconds = actualDurationSeconds;
    log.outcome.completionStatus      = completionStatus;
    log.outcome.painPostConfirmed     = Boolean(painPostConfirmed);

    if (settingSource) {
      log.mlAudit.settingSource = settingSource;
    }

    // ── Pilot feasibility study outcomes [MUST] ───────────────────────────────
    // If this is a pilot session, write primary and safety outcomes.
    // adverseEvent is mandatory on every completed pilot session.
    if (log.pilot?.trialArm) {
      const pilotBaseline = log.pilot.painPre_baseline ?? log.context.painPre;

      // PRIMARY OUTCOME: pain change at 15 minutes
      if (pilotFeedback.painPost_15min != null) {
        log.pilot.painPost_15min         = parseFloat(pilotFeedback.painPost_15min);
        log.pilot.painPostConfirmed_15min = Boolean(pilotFeedback.painPostConfirmed_15min);
        log.pilot.deltaPain_15min        = round2(pilotBaseline - log.pilot.painPost_15min);
      }

      // SECONDARY OUTCOME: immediate post-session pain change
      if (painPost != null) {
        log.pilot.deltaPain_0min = round2(pilotBaseline - painPost);
      }

      // MANDATORY safety fields
      log.pilot.adverseEvent        = Boolean(pilotFeedback.adverseEvent ?? false);
      log.pilot.adverseCategory     = pilotFeedback.adverseCategory     || 'NONE';
      log.pilot.adverseSeverity     = pilotFeedback.adverseSeverity     || 'NONE';
      log.pilot.earlyTermination    = Boolean(pilotFeedback.earlyTermination ?? false);
      log.pilot.earlyTerminationReason = pilotFeedback.earlyTerminationReason || 'NONE';

      // EMG window aggregates (computed client-side or by a background job)
      if (pilotFeedback.emg_pre_rms != null)   log.pilot.emg_pre_rms   = parseFloat(pilotFeedback.emg_pre_rms);
      if (pilotFeedback.emg_pre_mean != null)  log.pilot.emg_pre_mean  = parseFloat(pilotFeedback.emg_pre_mean);
      if (pilotFeedback.emg_post_rms != null)  log.pilot.emg_post_rms  = parseFloat(pilotFeedback.emg_post_rms);
      if (pilotFeedback.emg_post_mean != null) log.pilot.emg_post_mean = parseFloat(pilotFeedback.emg_post_mean);
      if (log.pilot.emg_pre_rms != null && log.pilot.emg_post_rms != null) {
        log.pilot.delta_emg_clean_rms = round2(log.pilot.emg_pre_rms - log.pilot.emg_post_rms);
      }

      // Telemetry quality
      if (pilotFeedback.telemetry_packet_count != null) {
        log.pilot.telemetry_packet_count    = parseInt(pilotFeedback.telemetry_packet_count, 10);
      }
      if (pilotFeedback.telemetry_packet_loss_pct != null) {
        log.pilot.telemetry_packet_loss_pct = parseFloat(pilotFeedback.telemetry_packet_loss_pct);
      }

      // Flag for review: any adverse event with SKIN_BURNING or earlyTerminationReason TOO_HOT even if MILD
      if (
        log.pilot.adverseCategory === 'SKIN_BURNING' ||
        log.pilot.earlyTerminationReason === 'TOO_HOT'
      ) {
        log.pilot.flaggedForReview = true;
        log.pilot.reviewFlagReason =
          log.pilot.adverseCategory === 'SKIN_BURNING'
            ? `Adverse event: SKIN_BURNING (severity: ${log.pilot.adverseSeverity})`
            : 'Early termination reason: TOO_HOT';
        console.warn(
          `⚠️ [PILOT SAFETY REVIEW] Log ${log._id} flagged for supervisor review: ` +
          `category=${log.pilot.adverseCategory}, severity=${log.pilot.adverseSeverity}, ` +
          `earlyTerminationReason=${log.pilot.earlyTerminationReason}`
        );
      }

      // MODERATE/SEVERE adverse event: suspend participant (blocks further sessions)
      // This is queryable via GET /api/pilot/suspensions — not just a log line.
      if (log.pilot.adverseSeverity === 'SEVERE' || log.pilot.adverseSeverity === 'MODERATE') {
        await suspendParticipantOnAdverseEvent(userId, {
          logId:           log._id,
          adverseCategory: log.pilot.adverseCategory,
          adverseSeverity: log.pilot.adverseSeverity,
        });
      }
    }

    await log.save();

    // Increment nextSessionOrder on COMPLETED pilot sessions (not CANCELLED)
    if (log.pilot?.trialArm && completionStatus === 'COMPLETED') {
      const { default: PilotParticipant } = await import('../../models/PilotParticipant.js');
      await PilotParticipant.findOneAndUpdate(
        { userId, nextSessionOrder: log.pilot.sessionOrderForParticipant },
        {
          $inc:      { nextSessionOrder: 1 },
          $addToSet: { completedSessionLogIds: log._id },
        }
      );
    }


    res.json({
      success: true,
      outcome: {
        painPre,
        painPost,
        deltaPain,
        reliefCategory: log.reliefCategory,
        completionStatus,
        // Echo pilot primary outcome back to client
        ...(log.pilot?.trialArm && {
          pilotPrimaryOutcome: {
            deltaPain_15min:        log.pilot.deltaPain_15min,
            painPostConfirmed_15min: log.pilot.painPostConfirmed_15min,
            adverseEvent:           log.pilot.adverseEvent,
          },
        }),
      },
      message: deltaPain > 0
        ? `Great! Pain reduced by ${deltaPain} points.`
        : deltaPain === 0
        ? 'No change detected. We will adjust recommendations.'
        : 'We noticed discomfort. Please consult a healthcare provider if pain persists.',

    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/therapy/history ─────────────────────────────────────────────────
// Returns the user's therapy session history with outcomes
router.get('/history', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(50, parseInt(req.query.limit || '10'));

    const [logs, total] = await Promise.all([
      TherapyLog.find({ userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-mlAudit.allPresetScores'), // omit large field from list view
      TherapyLog.countDocuments({ userId }),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/therapy/compare ─────────────────────────────────────────────────
// Aggregate: AI vs Rule-based average deltaPain comparison
router.get('/compare', authGuard, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [mlStats, ruleStats] = await Promise.all([
      TherapyLog.aggregate([
        {
          $match: {
            userId,
            'mlAudit.settingSource': 'ml_recommendation',
            'outcome.deltaPain': { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            avgDeltaPain: { $avg: '$outcome.deltaPain' },
            count:        { $sum: 1 },
          },
        },
      ]),
      TherapyLog.aggregate([
        {
          $match: {
            userId,
            'mlAudit.settingSource': { $in: ['fallback_rule', 'safety_override'] },
            'outcome.deltaPain': { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            avgDeltaPain: { $avg: '$outcome.deltaPain' },
            count:        { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      comparison: {
        aiModel: {
          avgDeltaPain: round2(mlStats[0]?.avgDeltaPain ?? null),
          sessionCount: mlStats[0]?.count ?? 0,
        },
        ruleBased: {
          avgDeltaPain: round2(ruleStats[0]?.avgDeltaPain ?? null),
          sessionCount: ruleStats[0]?.count ?? 0,
        },
        uplift: mlStats[0] && ruleStats[0]
          ? round2(mlStats[0].avgDeltaPain - ruleStats[0].avgDeltaPain)
          : null,
        note: 'Uplift = AI avg ΔPain − Rule-based avg ΔPain. Positive = AI is better.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strict context validator (Fix 1).
 * Returns an array of field-name strings that are invalid.
 * An empty array means all fields are acceptable.
 */
function validateContextInputs(ctx) {
  const errors = [];

  // painPre is required and must be a number in [0, 10]
  const rawPain = ctx.painPre;
  if (rawPain === undefined || rawPain === null || rawPain === '') {
    errors.push('painPre:required');
  } else {
    const n = parseFloat(rawPain);
    if (isNaN(n))  errors.push('painPre:nonNumeric');
    else if (n < 0 || n > 10) errors.push('painPre:outOfRange[0-10]');
  }

  // Optional numeric fields: if provided, must be numeric
  const numericOptional = [
    ['emg',                  0,   100],
    ['cycleDay',             1,    28],
    ['stress',               0,    10],
    ['fatigue',              0,    10],
    ['minutesSinceMedication', 0, 9999],
    ['skinTempIn',          30,    45],
  ];
  for (const [field, min, max] of numericOptional) {
    const v = ctx[field];
    if (v !== undefined && v !== null && v !== '') {
      const n = parseFloat(v);
      if (isNaN(n)) {
        errors.push(`${field}:nonNumeric`);
      } else if (n < min || n > max) {
        errors.push(`${field}:outOfRange[${min}-${max}]`);
      }
    }
  }

  return errors;
}

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
