import mongoose from 'mongoose';

/**
 * SensorReading — stores every JSON packet received from the ESP32 PainReliefBand.
 *
 * ESP32 payload shape:
 * {
 *   "deviceId":   "PainReliefBand-01",
 *   "temp":       37.2,
 *   "bpm":        85,
 *   "motor":      false,
 *   "heater":     false,
 *   "autoMode":   true,
 *   "active":     false,
 *   "sensorError":false,
 *   "timestamp":  12345
 * }
 */
const sensorReadingSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    temp: {
      type: Number,
      required: true,
    },
    bpm: {
      type: Number,
      required: true,
    },
    motor: {
      type: Boolean,
      default: false,
    },
    heater: {
      type: Boolean,
      default: false,
    },
    autoMode: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    sensorError: {
      type: Boolean,
      default: false,
    },
    /** Epoch millis from ESP32 internal clock */
    espTimestamp: {
      type: Number,
    },
    /** Server-side receipt time */
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    collection: 'sensor_readings',
  }
);

// Compound index for efficient device + time queries
sensorReadingSchema.index({ deviceId: 1, receivedAt: -1 });

export default mongoose.model('SensorReading', sensorReadingSchema);
