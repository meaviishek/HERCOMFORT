import mongoose from 'mongoose';

/**
 * TherapyLog — one document per therapy session attempt.
 *
 * Captures the complete ML pipeline audit trail:
 *   Context (input features) → Preset Chosen → Safety Clamp → Outcome
 *
 * This is the training corpus for Phase 2 (real empirical data).
 * Fields are deliberately comprehensive for off-policy evaluation (IPS/OPE).
 *
 * PILOT FEASIBILITY STUDY FIELDS (see `pilot` subdocument below):
 *   All pilot fields are additive — non-pilot sessions leave these null.
 *   Analysis is INTENTION-TO-TREAT by pilot.trialArm.
 *   Participants may only DECREASE heat/intensity during sessions.
 *   All setting changes are logged in SensorReading.isUserModification.
 */
const therapyLogSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    sessionId: {
      type: String,
      index: true,
    },

    // ── Context Features (Input X) ────────────────────────────────────────────
    context: {
      /** Pain level reported by user before session (VAS 0–10) */
      painPre: {
        type: Number, required: true, min: 0, max: 10,
      },
      /** RMS EMG envelope from belt BioAmp sensor (0–100) */
      emg: {
        type: Number, min: 0, max: 100, default: null,
      },
      /** Posture from IMU firmware */
      posture: {
        type: String,
        enum: ['LYING', 'UPRIGHT', 'WALKING', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      /** Day of menstrual cycle (1–28) */
      cycleDay: {
        type: Number, min: 1, max: 28, default: null,
      },
      /** Self-reported stress level (0–10) */
      stress: {
        type: Number, min: 0, max: 10, default: null,
      },
      /** Self-reported fatigue level (0–10) */
      fatigue: {
        type: Number, min: 0, max: 10, default: null,
      },
      /** Did the user take pain medication in the last 4 hours? */
      tookMedication: {
        type: Boolean, default: false,
      },
      /** Minutes since last pain medication dose (0 = no med taken) */
      minutesSinceMedication: {
        type: Number, min: 0, default: 0,
      },
      /** Skin temperature reading from belt at session start (°C) */
      skinTempIn: {
        type: Number, default: null,
      },
    },

    // ── Chosen Action (Preset Applied) ────────────────────────────────────────
    preset: {
      /** Preset ID from approved presets (P01–P12) or pilot arm IDs */
      presetId: {
        type: String,
        required: true,
        enum: [
          'P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12',
          'ARM_HEAT_ONLY', 'ARM_HEAT_PULSE', 'ARM_HEAT_HARMONIC',
        ],
      },
      presetName:     { type: String },
      targetTemp:     { type: Number, min: 36.0, max: 40.0, required: true },
      vibrationMode:  { type: String, enum: ['OFF', 'CONTINUOUS', 'PULSE', 'HARMONIC'], required: true },
      vibrationSpeed: { type: Number, min: 0, max: 100, required: true },
      durationMin:    { type: Number, enum: [10, 15, 20, 30], required: true },
    },

    // ── ML Audit Block ────────────────────────────────────────────────────────
    mlAudit: {
      /**
       * Model version that made this recommendation.
       * e.g. "baseline-rules-v1.0" | "preset-scorer-v1.0" | "pilot-trial-v1.0"
       */
      modelVersion: {
        type: String,
        required: true,
        default: 'baseline-rules-v1.0',
      },

      /**
       * Who/what made the final decision?
       *   ml_recommendation : Pure ML scorer chose the preset
       *   trial_allocator   : Pilot trial arm allocator assigned this session
       *   user_manual       : User overrode the slider after AI suggestion
       *   fallback_rule     : Sensor NaN / input validation failed → safe default
       *   safety_override   : Safety interceptor forced a safer preset
       */
      settingSource: {
        type: String,
        required: true,
        enum: ['ml_recommendation', 'trial_allocator', 'user_manual', 'fallback_rule', 'safety_override'],
        default: 'fallback_rule',
      },

      /**
       * Probability that this preset was selected given the context.
       * = 1/K in pilot trial mode (uniform, K=3 arms).
       * = 1.0 for deterministic rule selection.
       */
      propensity: {
        type: Number,
        required: true,
        min: 0.0,
        max: 1.0,
        default: 1.0,
      },

      /** Did the safety interceptor modify the raw ML/allocator output? */
      wasClamped: {
        type: Boolean,
        required: true,
        default: false,
      },

      /** Details of what the safety clamp changed (populated only if wasClamped=true) */
      clampDetails: {
        originalTargetTemp:  { type: Number, default: null },
        clampedTargetTemp:   { type: Number, default: null },
        originalSpeed:       { type: Number, default: null },
        clampedSpeed:        { type: Number, default: null },
        reason:              { type: String, default: null },
      },

      /** ML scorer's predicted ΔPain for the chosen preset (before session) */
      predictedDeltaPain: { type: Number, default: null },

      /** All preset scores from the scorer (for off-policy analysis) */
      allPresetScores: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },

      /** Time taken by the JS inference scorer (milliseconds) */
      inferenceLatencyMs: { type: Number, default: null },
    },

    // ── Pilot Feasibility Study [MUST fields] ─────────────────────────────────
    /**
     * Subdocument for all pilot study fields.
     * Non-pilot sessions leave every field here as null.
     * Data dictionary: ml/data_dictionary.json
     * Allocator: ml/trial_allocator.js
     * Analysis: ml/evaluate_lopo.py, ml/data_readiness_report.js
     */
    pilot: {
      // ── Arm Allocation (MUST) ────────────────────────────────────────────
      /**
       * Assigned arm for this session (set by trial_allocator.js).
       * Analysis is ITT — by assigned arm regardless of participant modifications.
       * Participants may only DECREASE heat/intensity; all changes logged in
       * SensorReading.isUserModification + modificationDirection.
       */
      trialArm: {
        type: String,
        enum: ['ARM_HEAT_ONLY', 'ARM_HEAT_PULSE', 'ARM_HEAT_HARMONIC'],
        default: null,
      },
      /**
       * This participant's Nth session in the study (1, 2, 3).
       * Carry-over covariate in the linear mixed-effects model.
       */
      sessionOrderForParticipant: {
        type: Number, min: 1, max: 3, default: null,
      },
      /**
       * Latin-square sequence index (0–5).
       * Maps to trial_allocator.js LATIN_SQUARE_SEQUENCES[sequenceIndex].
       * Enables full allocation audit without extra DB state.
       */
      sequenceIndex: {
        type: Number, min: 0, max: 5, default: null,
      },

      // ── Dual Pre-Session Baseline (MUST) ──────────────────────────────────
      /**
       * Two pain readings 5 min apart capture spontaneous pain volatility
       * before device activation — controls for regression-to-the-mean.
       */
      painPre_tMinus5: {
        type: Number, min: 0, max: 10, default: null, // T-5 min reading
      },
      painPre_t0: {
        type: Number, min: 0, max: 10, default: null, // Session start tap reading
      },
      /**
       * Primary baseline = mean(tMinus5, t0).
       * All delta calculations use this: deltaPain_Xmin = painPre_baseline - painPost_Xmin.
       */
      painPre_baseline: {
        type: Number, min: 0, max: 10, default: null,
      },

      // ── PRIMARY OUTCOME: Pain change at 15 minutes (MUST) ─────────────────
      /**
       * App sends push notification at T+15 min post-session.
       * If painPostConfirmed_15min=false, session is excluded from primary analysis.
       * Mixed-effects model: deltaPain_15min ~ trialArm + cycleDay +
       *   sessionOrderForParticipant + tookMedication + (1 | participantId)
       */
      painPost_15min:           { type: Number, min: 0, max: 10, default: null },
      painPostConfirmed_15min:  { type: Boolean, default: false },
      /** PRIMARY OUTCOME variable: painPre_baseline - painPost_15min */
      deltaPain_15min:          { type: Number, default: null },

      // ── SECONDARY OUTCOME: Immediate post-session pain change (MUST) ───────
      /**
       * Computed at session end: painPre_baseline - outcome.painPost
       * Secondary outcome — not the primary analysis variable.
       */
      deltaPain_0min: { type: Number, default: null },

      // ── EMG Window Aggregates (MUST, derived at session end) ───────────────
      /**
       * Computed from SensorReading packets in motor-off windows:
       *   PRE_BASELINE:  elapsedSec 0–60,    heater OFF, motor OFF → clean resting EMG
       *   POST_BASELINE: elapsedSec 1140–1200, heater ON, motor OFF → clean post-Rx EMG
       * Motor-off windows eliminate vibration electrical artifact from the BioAmp signal.
       * Exploratory outcome — subject to signal quality gate in data_readiness_report.js.
       */
      emg_pre_rms:         { type: Number, default: null },
      emg_pre_mean:        { type: Number, default: null },
      emg_post_rms:        { type: Number, default: null },
      emg_post_mean:       { type: Number, default: null },
      /** Exploratory EMG change score: emg_pre_rms - emg_post_rms */
      delta_emg_clean_rms: { type: Number, default: null },

      // ── Telemetry Quality Metrics (MUST) ──────────────────────────────────
      telemetry_packet_count:    { type: Number, default: null },
      /** Feasibility metric: (expected_packets - received) / expected × 100 */
      telemetry_packet_loss_pct: { type: Number, min: 0, max: 100, default: null },

      // ── Adverse Events — Mandatory Safety Reporting (MUST) ────────────────
      /**
       * Must be explicitly set on every completed pilot session.
       * adverseEvent=true requires adverseCategory and adverseSeverity.
       * All MODERATE/SEVERE events must be reported to the study supervisor.
       */
      adverseEvent:         { type: Boolean, default: false },
      adverseCategory: {
        type: String,
        enum: ['NONE', 'MILD_ERYTHEMA', 'SKIN_BURNING', 'NUMBNESS', 'NAUSEA', 'DIZZINESS', 'OTHER'],
        default: 'NONE',
      },
      adverseSeverity: {
        type: String,
        enum: ['NONE', 'MILD', 'MODERATE', 'SEVERE'],
        default: 'NONE',
      },

      // ── Early Termination (MUST) ───────────────────────────────────────────
      earlyTermination: { type: Boolean, default: false },
      earlyTerminationReason: {
        type: String,
        enum: ['NONE', 'PAIN_RESOLVED', 'TOO_HOT', 'TOO_INTENSE', 'DEVICE_DISCOMFORT', 'OTHER'],
        default: 'NONE',
      },

      // ── Safety Flags & Review ─────────────────────────────────────────────
      /**
       * Flagged for study supervisor review (e.g. SKIN_BURNING, TOO_HOT, even if MILD).
       * Distinguishes non-suspending review flags from MODERATE/SEVERE participant suspensions.
       */
      flaggedForReview: { type: Boolean, default: false },
      reviewFlagReason: { type: String, default: null },

      // ── Device Provenance (MUST) ───────────────────────────────────────────
      firmwareVersion: { type: String, default: null },
      appVersion:      { type: String, default: null },
    },

    // ── Outcome (Target Y — standard, non-pilot) ──────────────────────────────
    outcome: {
      /** Pain reported after session ends (VAS 0–10). null = incomplete */
      painPost: { type: Number, min: 0, max: 10, default: null },
      /**
       * ΔPain = painPre - painPost (context.painPre baseline, not pilot dual-baseline).
       * Positive = pain decreased (relief). Negative = worsened.
       */
      deltaPain:             { type: Number, default: null },
      actualDurationSeconds: { type: Number, default: null },
      /**
       * Session completion status.
       * IN_PROGRESS older than 3h automatically transitions to ABANDONED.
       * Neither CANCELLED nor ABANDONED sessions consume the participant's trial arm.
       */
      completionStatus: {
        type: String,
        enum: ['COMPLETED', 'CANCELLED', 'IN_PROGRESS', 'ABANDONED'],
        default: 'IN_PROGRESS',
      },
      /**
       * Did the user explicitly tap a post-pain score on the slider?
       * Primary export filter in export_pilot_dataset.js.
       */
      painPostConfirmed: { type: Boolean, default: false },
    },

    // ── Contraindication Screening ────────────────────────────────────────────
    contraindications: {
      pregnancy:      { type: Boolean, default: false },
      pacemaker:      { type: Boolean, default: false },
      skinCondition:  { type: Boolean, default: false },
      therapyBlocked: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    collection: 'therapy_logs',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: Human-readable relief outcome ────────────────────────────────────
therapyLogSchema.virtual('reliefCategory').get(function () {
  const d = this.outcome?.deltaPain;
  if (d == null) return 'PENDING';
  if (d >= 4) return 'SIGNIFICANT_RELIEF';
  if (d >= 2) return 'MODERATE_RELIEF';
  if (d >= 0) return 'MINIMAL_RELIEF';
  return 'NO_RELIEF';
});

// ── Indexes ───────────────────────────────────────────────────────────────────
therapyLogSchema.index({ userId: 1, createdAt: -1 });
therapyLogSchema.index({ 'mlAudit.modelVersion': 1 });
therapyLogSchema.index({ 'mlAudit.settingSource': 1 });
therapyLogSchema.index({ 'preset.presetId': 1 });
therapyLogSchema.index({ 'outcome.deltaPain': -1 });
// Pilot study indexes
therapyLogSchema.index({ 'pilot.trialArm': 1 });
therapyLogSchema.index({ 'pilot.sessionOrderForParticipant': 1 });
therapyLogSchema.index({ 'pilot.painPostConfirmed_15min': 1 });
therapyLogSchema.index({ 'pilot.adverseEvent': 1 });

export default mongoose.model('TherapyLog', therapyLogSchema);
