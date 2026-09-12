import mongoose from 'mongoose';

/**
 * Session — stores completed therapy sessions and extracted biometric features.
 * Features calculated:
 *  - emgRms: Root Mean Square of pelvic/uterine EMG muscle contraction
 *  - avgTemp, maxTemp: thermal response stats
 *  - imuStats: average and maximum movement magnitude
 *  - durationSeconds: exact elapsed time (e.g. user ended in 5 min -> 300s)
 */
const sessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
    },
    deviceId: {
      type: String,
      default: 'HER-COMFORT',
      index: true,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: Date.now,
    },
    /** Exact duration in seconds */
    durationSeconds: {
      type: Number,
      required: true,
    },
    /** Duration in minutes (rounded) */
    durationMin: {
      type: Number,
      required: true,
    },
    painBefore: {
      type: Number,
      min: 0,
      max: 10,
      default: 5,
    },
    painAfter: {
      type: Number,
      min: 0,
      max: 10,
      default: 3,
    },
    location: {
      type: String,
      default: 'Lower abdomen',
    },
    symptoms: {
      type: [String],
      default: [],
    },
    therapy: {
      heatEnabled: { type: Boolean, default: true },
      targetTemp: { type: Number, default: 40 },
      vibEnabled: { type: Boolean, default: true },
      vibIntensity: { type: Number, default: 70 },
      vibMode: { type: String, default: 'Pulse' },
    },
    features: {
      emgRms: { type: Number, default: 0 },
      avgTemp: { type: Number, default: 36.6 },
      maxTemp: { type: Number, default: 36.6 },
      imuStats: {
        avgMovement: { type: Number, default: 0 },
        maxMovement: { type: Number, default: 0 },
      },
      contractionLevel: {
        type: String,
        enum: ['Relaxed', 'Low Contraction', 'Moderate Contraction', 'High Contraction'],
        default: 'Relaxed',
      },
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'therapy_sessions',
  }
);

sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ deviceId: 1, createdAt: -1 });

export default mongoose.model('Session', sessionSchema);
