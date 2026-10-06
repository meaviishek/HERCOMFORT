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
      default: 0,
    },
    /** Duration in minutes (rounded) */
    durationMin: {
      type: Number,
      default: 0,
    },
    /** Target duration in minutes set at session start (e.g. 10, 15, 20, 30) */
    targetDurationMin: {
      type: Number,
      default: 15,
    },
    /** Session lifecycle status */
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
      default: 'IN_PROGRESS',
      index: true,
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
      default: null,
    },
    location: {
      type: String,
      default: 'Lower Abdomen',
    },
    symptoms: {
      type: [String],
      default: [],
    },
    therapy: {
      /** Heater */
      heatEnabled:  { type: Boolean, default: false },
      targetTemp:   { type: Number,  default: 40 },
      /** Motor / vibration */
      vibEnabled:   { type: Boolean, default: false },
      vibIntensity: { type: Number,  default: 100 },
      /** OFF | CONTINUOUS | PULSE | HARMONIC */
      vibMode:      { type: String,  default: 'CONTINUOUS' },
    },
    features: {
      /** Root-mean-square of EMG envelope during session */
      emgRms:   { type: Number, default: 0 },
      /** Snapshot waveform (last 30 points) */
      emgPoints: { type: [Number], default: [] },
      avgTemp:   { type: Number, default: 36.6 },
      maxTemp:   { type: Number, default: 36.6 },
      imuStats: {
        avgMovement: { type: Number, default: 0 },
        maxMovement: { type: Number, default: 0 },
      },
      /** Average body angle from upright during session (degrees) */
      avgBodyAngle: { type: Number, default: 0 },
      /** Most common position reported by firmware */
      primaryPosition: {
        type: String,
        enum: ['UPRIGHT', 'WALKING', 'LYING', 'UNKNOWN'],
        default: 'UNKNOWN',
      },
      /**
       * EMG muscle-tone classification at session end.
       * Maps to Her Comfort thresholds:
       *   < 20         → MUSCLE_FREE
       *   20 – 34      → RELAXED
       *   35 – 49      → SLIGHTLY_TIGHT
       *   50 – 79      → HIGH_TIGHTNESS
       *   >= 80        → EXTREME_CONTRACTION
       */
      contractionLevel: {
        type: String,
        enum: [
          'MUSCLE_FREE',
          'RELAXED',
          'SLIGHTLY_TIGHT',
          'HIGH_TIGHTNESS',
          'EXTREME_CONTRACTION',
        ],
        default: 'MUSCLE_FREE',
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/** Computed pain relief percentage — positive means improvement */
sessionSchema.virtual('painReductionPct').get(function () {
  if (this.painAfter == null || this.painBefore == null || this.painBefore === 0) return 0;
  return Math.round(((this.painBefore - this.painAfter) / this.painBefore) * 100);
});

sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ deviceId: 1, createdAt: -1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ 'features.contractionLevel': 1 });

export default mongoose.model('Session', sessionSchema);
