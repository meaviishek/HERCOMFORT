import mongoose from 'mongoose';

/**
 * PilotParticipant — One document per enrolled pilot study participant.
 *
 * SECURITY MODEL
 * --------------
 * participantId is derived SERVER-SIDE from userId using a deterministic
 * hash (sha256 of userId + PARTICIPANT_ID_SALT). The client NEVER sends
 * a participantId — it is always looked up by authenticated userId.
 *
 * userId is a hard foreign key to User._id. participantId (P001–P999) is
 * the de-identified label used in all exported research data. The mapping
 * is stored in this collection and NEVER exported in CSV/research data.
 *
 * ADVERSE EVENT BLOCKING
 * ----------------------
 * If a MODERATE or SEVERE adverse event is recorded for a session belonging
 * to this participant, `studyStatus` is set to 'SUSPENDED' and `suspendedReason`
 * records the logId and category. Sessions cannot be created while suspended.
 * The study supervisor must explicitly set `studyStatus = 'ACTIVE'` after review.
 *
 * CANCELLED SESSIONS
 * ------------------
 * A CANCELLED session does NOT consume a sessionOrder slot. The route must
 * check `completedSessionOrders` and assign the same sessionOrder again if
 * the previous attempt was cancelled. `nextSessionOrder` is the source of
 * truth — it is only incremented on COMPLETED sessions.
 */
const pilotParticipantSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    /**
     * Reference to the authenticated User account.
     * This link is confidential and must never appear in exported data.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    /**
     * De-identified participant label (e.g. "P001").
     * Derived server-side: sha256(userId.toString() + PARTICIPANT_ID_SALT)
     * padded to PXXX format. Never sent by the client.
     * Never stored in any research CSV alongside PII.
     */
    participantId: {
      type:     String,
      required: true,
      unique:   true,
      match:    /^P[0-9]{3}$/,
    },

    /**
     * 1-indexed enrollment sequence counter (1, 2, 3...).
     * Assigned atomically at enrollment. Used to lookup Latin-square sequence
     * in the permuted block schedule (blocks of 6).
     */
    enrollmentOrder: {
      type:     Number,
      required: true,
      unique:   true,
      min:      1,
    },

    // ── Consent ───────────────────────────────────────────────────────────────
    /**
     * Version string of the consent form the participant agreed to.
     * e.g. "1.0.0" — must match PILOT_CONSENT_VERSION env var at enrollment.
     * If consent version changes, re-consent is required (new enrollment doc).
     */
    consentVersion: {
      type: String,
      required: true,
    },
    /**
     * Server-side timestamp of consent confirmation.
     * Set at enrollment; never modifiable after creation.
     */
    consentTimestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // ── Enrollment Status ─────────────────────────────────────────────────────
    /**
     * Study participation status.
     *   ACTIVE    : Participant may attend sessions (normal state).
     *   SUSPENDED : Sessions blocked pending supervisor review.
     *              Set automatically when MODERATE/SEVERE adverse event is recorded.
     *   WITHDRAWN : Participant has withdrawn consent. No further sessions.
     *   COMPLETED : All 3 sessions completed.
     */
    studyStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'COMPLETED'],
      default: 'ACTIVE',
    },
    /**
     * Reason for SUSPENDED or WITHDRAWN status.
     * Contains { logId, adverseCategory, adverseSeverity, timestamp } for suspensions.
     */
    suspendedReason: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    /**
     * ISO timestamp of the suspension event.
     * Used to enforce a minimum review period before reactivation.
     */
    suspendedAt: {
      type: Date,
      default: null,
    },

    // ── Session Tracking ──────────────────────────────────────────────────────
    /**
     * Latin-square sequence index assigned at enrollment (0–5).
     * Derived by trial_allocator.js from participantId.
     * Stored here for audit: confirms the sequence without re-computation.
     */
    sequenceIndex: {
      type: Number,
      min: 0,
      max: 5,
      required: true,
    },
    /**
     * All 3 arms in the order assigned to this participant.
     * e.g. ["ARM_HEAT_ONLY", "ARM_HEAT_PULSE", "ARM_HEAT_HARMONIC"]
     * Stored for audit — never sent to the client before the session.
     */
    trialArmSequence: {
      type: [String],
      enum: ['ARM_HEAT_ONLY', 'ARM_HEAT_PULSE', 'ARM_HEAT_HARMONIC'],
      required: true,
    },
    /**
     * The next session order to be assigned (1, 2, or 3).
     * Incremented ONLY on COMPLETED sessions (not CANCELLED).
     * This is the server-side source of truth for sessionOrder.
     * When nextSessionOrder > 3, studyStatus should be 'COMPLETED'.
     */
    nextSessionOrder: {
      type: Number,
      min: 1,
      max: 4, // 4 = all sessions done
      default: 1,
    },
    /**
     * Array of TherapyLog _ids for COMPLETED sessions only.
     * Used to verify arm coverage and prevent double-assignment.
     */
    completedSessionLogIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'TherapyLog',
      default: [],
    },
    /**
     * Array of TherapyLog _ids for CANCELLED sessions.
     * Kept for audit; sessionOrder was not consumed by these.
     */
    cancelledSessionLogIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'TherapyLog',
      default: [],
    },

    // ── Baseline Fields (Must) ────────────────────────────────────────────────
    /**
     * Participant age at enrollment (years).
     * Inclusion criterion: 18–45.
     */
    age: { type: Number, min: 18, max: 45, default: null },
    /**
     * Self-reported typical menstrual cycle length (days).
     */
    cycleLengthTypical: { type: Number, min: 21, max: 40, default: null },
    /**
     * Self-reported typical bleeding duration (days).
     */
    periodDurationTypical: { type: Number, min: 2, max: 10, default: null },
    /**
     * Self-reported baseline cramp severity on unmedicated cycle (VAS 0–10).
     */
    baselinePainSeverityTypical: { type: Number, min: 0, max: 10, default: null },
    /**
     * Dysmenorrhoea classification.
     */
    dysmenorrheaType: {
      type: String,
      enum: ['PRIMARY', 'SECONDARY', 'UNCONFIRMED'],
      default: 'UNCONFIRMED',
    },

    // ── Exclusion Screening (Must — recorded at enrollment) ───────────────────
    /** Confirmed absence of pregnancy at enrollment */
    screeningPregnancyNegative: { type: Boolean, default: null },
    /** Confirmed absence of pacemaker / active implant */
    screeningNoPacemaker: { type: Boolean, default: null },
    /** Confirmed absence of relevant skin condition */
    screeningNoSkinCondition: { type: Boolean, default: null },
    /**
     * Did this participant pass all screening checks?
     * Must be true before any session can be started.
     */
    screeningPassed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'pilot_participants',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtual: current arm for the next session ─────────────────────────────────
pilotParticipantSchema.virtual('nextArm').get(function () {
  const idx = this.nextSessionOrder - 1;
  if (idx >= 0 && idx < this.trialArmSequence.length) {
    return this.trialArmSequence[idx];
  }
  return null;
});

// ── Static: look up or create participant by userId ───────────────────────────
/**
 * Find the PilotParticipant for an authenticated userId.
 * Does NOT create one — enrollment is a separate explicit step.
 * @param {ObjectId|string} userId
 * @returns {Promise<PilotParticipant|null>}
 */
pilotParticipantSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId });
};

// ── Indexes ───────────────────────────────────────────────────────────────────
// participantId: unique:true above already creates the index
pilotParticipantSchema.index({ studyStatus: 1 });

export default mongoose.model('PilotParticipant', pilotParticipantSchema);
