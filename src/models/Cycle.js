const mongoose = require("mongoose");

const cycleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    flowLogs: [
      {
        date: { type: Date, required: true },
        level: {
          type: String,
          enum: ["light", "medium", "heavy"],
          required: true,
        },
      },
    ],
    symptoms: [
      {
        type: String,
        enum: [
          "cramps","bloating","headache","fatigue","mood_swings",
          "breast_tenderness","acne","nausea","backache","spotting",
        ],
      },
    ],
    notes: {
      type: String,
      default: null,
      maxlength: 500,
    },
    periodDuration: {
      type: Number,
      default: null,
    },
    cycleLength: {
      type: Number,
      default: null,
    },
    isIrregular: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "cycles",
  }
);

cycleSchema.index({ user: 1, startDate: -1 });

module.exports = mongoose.model("Cycle", cycleSchema);
