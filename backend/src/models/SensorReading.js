import mongoose from 'mongoose';

/**
 * SensorReading — stores every JSON telemetry packet from the HerComfort ESP32-C6.
 *
 * PILOT FEASIBILITY STUDY CHANGES:
 *   • emgEnvelope: confirmed as the RMS envelope at ~2 Hz from the BioAmp circuit.
 *     This is NOT raw ADC — it is a processed amplitude envelope. Field was previously
 *     also called emgRaw in some docs; emgEnvelope is the canonical name.
 *   • windowType: logged on every packet based on elapsedSec thresholds.
 *     PRE_BASELINE (0–60s): heater OFF, motor OFF — clean resting EMG.
 *     ACTIVE_THERAPY (61–1140s): assigned arm protocol active.
 *     POST_BASELINE (1141–1200s): heater ON, motor OFF — clean post-Rx EMG.
 *   • heaterState: logged on every packet (was already 'heater' field; added alias).
 *   • isUserModification: true when participant changes settings during a session.
 *     Pilot rule: participants may only DECREASE heat or intensity.
 *   • modificationDirection: what was changed (downward only permitted).
 *   • modificationTimestampSec: elapsed seconds at time of change — for ITT audit.
 *
 * ESP32-C6 firmware payload (current):
 * {
 *   "temperature":    35.75,
 *   "position":       "UPRIGHT",
 *   "bodyAngle":      1.0,
 *   "motorMode":      "OFF",
 *   "motorSpeed":     100,
 *   "heater":         "OFF",
 *   "heaterSetpoint": 40.0,
 *   "emg":            6
 * }
 */
const sensorReadingSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true },

    // ── Thermal ───────────────────────────────────────────────────────────────
    /** Skin/surface temperature in degrees C */
    temp: { type: Number, required: true },

    // ── EMG BioAmp ────────────────────────────────────────────────────────────
    /**
     * EMG RMS envelope at ~2 Hz from the BioAmp circuit.
     * Range 0–100. This is a processed amplitude envelope, NOT raw ADC.
     * Previously also referred to as emgRaw in early documentation — emgEnvelope
     * is the canonical field name for all pilot data and analysis.
     *
     * Pilot baseline analysis uses packets where:
     *   windowType='PRE_BASELINE' AND motorState=false AND heaterState=false
     * to compute emg_pre_rms / emg_pre_mean without vibration artifact.
     */
    emgEnvelope: { type: Number, min: 0, max: 100 },

    /** Raw ADC value from BioAmp (legacy / debugging only — do NOT use for analysis) */
    emg:        { type: Number },
    /** Legacy raw ADC alias (retained for firmware compat) */
    raw_analog: { type: Number, default: 1700 },

    // ── Posture / IMU ─────────────────────────────────────────────────────────
    /** UPRIGHT | WALKING | LYING | UNKNOWN — computed by firmware MPU */
    position:  { type: String, enum: ['UPRIGHT', 'WALKING', 'LYING', 'UNKNOWN'] },
    /** Body angle from upright in degrees (0 = standing straight, 90 = lying) */
    bodyAngle: { type: Number },
    /** Raw IMU axes (legacy / debugging) */
    gx: { type: Number, default: 0 },
    gy: { type: Number, default: 0 },
    gz: { type: Number, default: 0 },

    // ── Motor / Vibration ─────────────────────────────────────────────────────
    /** Whether vibration motor is physically active */
    motor:     { type: Boolean, default: false },
    motorMode: { type: String, enum: ['OFF', 'CONTINUOUS', 'PULSE', 'HARMONIC'] },
    motorSpeed: { type: Number, min: 0, max: 100 },

    /**
     * [PILOT MUST] Explicit motorState boolean — true = motor is ON.
     * Must be false during PRE_BASELINE and POST_BASELINE windows.
     * Derived from motorMode at server receipt if not sent by firmware.
     */
    motorState: {
      type: Boolean,
      default: false,
    },

    // ── Heater ────────────────────────────────────────────────────────────────
    /** Whether heater is physically ON (firmware field name: heater) */
    heater: { type: Boolean, default: false },

    /**
     * [PILOT MUST] heaterState — logged on every packet.
     * Must be false during PRE_BASELINE window (first 60s of session).
     * This is the same signal as 'heater' field; stored explicitly for clarity
     * in pilot telemetry export and analysis scripts.
     */
    heaterState: {
      type: Boolean,
      default: false,
    },

    /** User-configured temperature setpoint in degrees C */
    heaterSetpoint: { type: Number },

    // ── Pilot Session Window Classification [PILOT MUST] ──────────────────────
    /**
     * Assigned on receipt based on (receivedAt - sessionStartTime):
     *   PRE_BASELINE:   0–60s,    heater OFF, motor OFF
     *   ACTIVE_THERAPY: 61–1140s, assigned arm active
     *   POST_BASELINE:  1141–1200s, motor OFF (forced), heater ON
     *
     * Used to gate EMG baseline aggregation in export_pilot_dataset.js.
     * Null for non-pilot sessions.
     */
    windowType: {
      type: String,
      enum: ['PRE_BASELINE', 'ACTIVE_THERAPY', 'POST_BASELINE'],
      default: null,
    },

    // ── Participant Modification Tracking [PILOT MUST] ────────────────────────
    /**
     * Pilot rule: participants may ONLY DECREASE heat or intensity during a session.
     * The app UI must block any upward change above the assigned arm setpoint.
     * Every packet after a user change has isUserModification=true.
     * Sessions are analyzed ITT by assigned arm regardless of modifications.
     */
    isUserModification: {
      type: Boolean,
      default: false,
    },
    /**
     * What the participant changed. Must always be downward.
     * NONE            : No modification (normal packet)
     * DECREASED_HEAT  : Participant lowered heat setpoint
     * DECREASED_INTENSITY: Participant lowered motor speed
     * STOPPED_MOTOR   : Participant turned motor off
     */
    modificationDirection: {
      type: String,
      enum: ['NONE', 'DECREASED_HEAT', 'DECREASED_INTENSITY', 'STOPPED_MOTOR'],
      default: 'NONE',
    },
    /**
     * Elapsed seconds from session start at the time of the modification.
     * 0 if isUserModification=false.
     */
    modificationTimestampSec: {
      type: Number,
      default: 0,
    },

    // ── Session Linkage ───────────────────────────────────────────────────────
    sessionId:    { type: String, index: true, sparse: true },
    /**
     * Seconds elapsed since session start at server receipt.
     * Set by the backend when writing the packet (receivedAt - sessionStartTime).
     * Used to assign windowType and compute EMG aggregate features.
     */
    elapsedSec:   { type: Number, default: null },

    // ── Timestamps ────────────────────────────────────────────────────────────
    /** Epoch millis from ESP32 internal clock */
    espTimestamp: { type: Number },
    /** Server-side receipt time */
    receivedAt: { type: Date, default: Date.now, index: true },

    // ── Legacy / Compatibility ────────────────────────────────────────────────
    bpm:         { type: Number, default: 72 },
    autoMode:    { type: Boolean, default: false },
    active:      { type: Boolean, default: true },
    sensorError: { type: Boolean, default: false },
  },
  {
    timestamps: false,
    collection: 'sensor_readings',
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Core queries
sensorReadingSchema.index({ deviceId: 1, receivedAt: -1 });
sensorReadingSchema.index({ sessionId: 1, receivedAt: -1 });
// Pilot baseline window queries
sensorReadingSchema.index({ sessionId: 1, windowType: 1, receivedAt: 1 });
// User modification audit
sensorReadingSchema.index({ sessionId: 1, isUserModification: 1 });

export default mongoose.model('SensorReading', sensorReadingSchema);
