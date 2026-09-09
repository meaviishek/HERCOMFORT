const mongoose = require("mongoose");

// ── WellnessLog ───────────────────────────────────────────────────────────────
// One document per user per calendar date.
// Mood, Sleep, Hydration, Symptoms are all upserted into this single doc.
const wellnessLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true },   // "YYYY-MM-DD"  — local date string

    // Mood
    mood: {
      value:   { type: String, enum: ["happy","good","neutral","sad","irritated","tired","anxious"] },
      emoji:   String,
      label:   String,
      note:    { type: String, default: "" },
      loggedAt: Date,
    },

    // Sleep
    sleep: {
      duration:  { type: Number, min: 0, max: 24 },   // hours
      quality:   { type: Number, min: 1, max: 5 },
      bedtime:   String,    // "10 PM"
      wakeTime:  String,    // "6 AM"
      loggedAt:  Date,
    },

    // Hydration
    hydration: {
      amount:  { type: Number, default: 0 },           // ml consumed
      goal:    { type: Number, default: 2500 },        // ml goal
      loggedAt: Date,
    },

    // Symptoms
    symptoms: {
      list:      { type: [String], default: [] },
      loggedAt:  Date,
    },
  },
  { timestamps: true }
);

// Compound unique index – one log per user per day
wellnessLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("WellnessLog", wellnessLogSchema);
