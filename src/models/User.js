const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    /** Hashed password — optional for Google-only accounts */
    password: {
      type: String,
      default: null,
    },
    /** Google OAuth user ID */
    googleId: {
      type: String,
      default: null,
      sparse: true,
    },
    avatar: {
      type: String,
      default: null,
    },

    // ─── Email Verification ───────────────────────────────────────────────────
    /** Whether email has been verified via OTP */
    isVerified: {
      type: Boolean,
      default: false,
    },
    /** Hashed OTP code (bcrypt) */
    otp: {
      type: String,
      default: null,
      select: false, // never returned in queries unless explicitly requested
    },
    /** OTP expiry timestamp */
    otpExpires: {
      type: Date,
      default: null,
    },
    /** Number of failed OTP attempts (reset on success / resend) */
    otpAttempts: {
      type: Number,
      default: 0,
    },

    // ─── Health Profile ───────────────────────────────────────────────────────
    /** Whether the user has completed their health profile */
    profileComplete: {
      type: Boolean,
      default: false,
    },
    profile: {
      dateOfBirth: {
        type: Date,
        default: null,
      },
      age: {
        type: Number,
        min: 1,
        max: 120,
        default: null,
      },
      weight: {
        type: Number, // kilograms
        min: 1,
        max: 500,
        default: null,
      },
      height: {
        type: Number, // centimetres
        min: 1,
        max: 300,
        default: null,
      },
      bloodGroup: {
        type: String,
        enum: BLOOD_GROUPS,
        default: null,
      },
    },

    /** Stored (hashed) refresh token for rotation invalidation */
    refreshToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

/** Hash password before saving */
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

/** Compare a plain-text password with the stored hash */
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

/** Never expose password, refreshToken, or OTP fields in JSON responses */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.otp;
  delete obj.otpExpires;
  delete obj.otpAttempts;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
