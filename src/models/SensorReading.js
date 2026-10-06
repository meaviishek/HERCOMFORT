import mongoose from 'mongoose';

/**
 * SensorReading — stores every JSON telemetry packet from the Her Comfort ESP32-C6.
 *
 * ESP32-C6 payload (Her Comfort firmware):
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

    // Thermal
    /** Skin/surface temperature in degrees C */
    temp: { type: Number, required: true },

    // EMG BioAmp
    /** Raw EMG value (0-100+, muscle contraction amplitude) */
    emg:         { type: Number },
    /** Processed EMG envelope (smoothed) */
    emgEnvelope: { type: Number },
    /** Legacy raw ADC value */
    raw_analog:  { type: Number, default: 1700 },

    // Posture / IMU
    /** UPRIGHT | WALKING | LYING | UNKNOWN — computed by firmware MPU */
    position:  { type: String, enum: ['UPRIGHT', 'WALKING', 'LYING', 'UNKNOWN'] },
    /** Body angle from upright in degrees (0 = standing straight, 90 = lying) */
    bodyAngle: { type: Number },
    /** Raw IMU axes (legacy / debugging) */
    gx: { type: Number, default: 0 },
    gy: { type: Number, default: 0 },
    gz: { type: Number, default: 0 },

    // Motor / Vibration
    /** Whether vibration motor is physically active */
    motor:     { type: Boolean, default: false },
    /** OFF | CONTINUOUS | PULSE | HARMONIC */
    motorMode: { type: String, enum: ['OFF', 'CONTINUOUS', 'PULSE', 'HARMONIC'] },
    /** Motor duty cycle 0-100 % */
    motorSpeed: { type: Number, min: 0, max: 100 },

    // Heater
    /** Whether heater is physically ON */
    heater:         { type: Boolean, default: false },
    /** User-configured temperature setpoint in degrees C */
    heaterSetpoint: { type: Number },

    // Legacy / compatibility
    bpm:         { type: Number, default: 72 },
    autoMode:    { type: Boolean, default: false },
    active:      { type: Boolean, default: true },
    sensorError: { type: Boolean, default: false },

    // Session linkage
    sessionId:    { type: String, index: true, sparse: true },

    /** Epoch millis from ESP32 internal clock */
    espTimestamp: { type: Number },
    /** Server-side receipt time */
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    collection: 'sensor_readings',
  }
);

// Compound indexes for efficient device + time queries
sensorReadingSchema.index({ deviceId: 1, receivedAt: -1 });
sensorReadingSchema.index({ sessionId: 1, receivedAt: -1 });

export default mongoose.model('SensorReading', sensorReadingSchema);
