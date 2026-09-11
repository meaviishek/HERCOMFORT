import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema(
  {
    user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name:      { type: String, required: true, trim: true },
    dose:      { type: String, default: "" },
    unit:      { type: String, default: "mg" },
    time:      { type: String, default: "8 AM" },
    frequency: { type: String, default: "Once daily" },
    notes:     { type: String, default: "" },
    active:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Medication", medicationSchema);
