import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../../../models/User.js';
import { sendOtpEmail } from '../../../services/emailService.js';

// ─── Constants ─────────────────────────────────────────────────────────────────
const OTP_TTL_MS = 10 * 60 * 1000;   // 10 minutes
const OTP_MAX_ATTEMPTS = 5;           // max wrong guesses before lockout

// ─── Token helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a short-lived access token + long-lived refresh token.
 * @param {string} userId
 * @returns {{ accessToken: string, refreshToken: string }}
 */
function generateTokens(userId) {
  const accessToken = jwt.sign(
    { sub: userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
  const refreshToken = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
  return { accessToken, refreshToken };
}

/**
 * Hash and store the refresh token on the user document (for rotation validation).
 */
async function storeRefreshToken(user, refreshToken) {
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save();
}

/**
 * Generate a secure 6-digit numeric OTP.
 */
function generateOtp() {
  // Use crypto for randomness, constrain to 6 digits
  const num = crypto.randomInt(100000, 999999);
  return String(num);
}

// ─── Auth Service ──────────────────────────────────────────────────────────────

const AuthService = {
  // ── Standard Email / Password ───────────────────────────────────────────────

  /**
   * Register a new user with email + password.
   * Legacy direct-register (no OTP) — kept for compatibility.
   */
  async register(name, email, password) {
    const existing = await User.findOne({ email });
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.status = 409;
      throw err;
    }

    const user = new User({ name, email, password, isVerified: true, profileComplete: false });
    await user.save(); // pre-save hook hashes the password

    const tokens = generateTokens(user._id.toString());
    await storeRefreshToken(user, tokens.refreshToken);

    return { user, ...tokens };
  },

  /**
   * Login with email + password.
   */
  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      const err = new Error('Invalid email or password.');
      err.status = 401;
      throw err;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      const err = new Error('Invalid email or password.');
      err.status = 401;
      throw err;
    }

    if (!user.isVerified) {
      const err = new Error('Please verify your email before logging in.');
      err.status = 403;
      throw err;
    }

    const tokens = generateTokens(user._id.toString());
    await storeRefreshToken(user, tokens.refreshToken);

    return { user, ...tokens };
  },

  // ── OTP Registration Flow ───────────────────────────────────────────────────

  /**
   * Step 1 — Create a pending (unverified) user and send an OTP to their email.
   * If the email already exists and is verified → reject.
   * If the email exists but is unverified → re-use the record and resend OTP.
   */
  async sendRegistrationOtp(name, email, password) {
    let user = await User.findOne({ email }).select('+otp');

    if (user && user.isVerified) {
      const err = new Error('An account with this email already exists.');
      err.status = 409;
      throw err;
    }

    const plainOtp = generateOtp();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    const otpExpires = new Date(Date.now() + OTP_TTL_MS);

    if (user) {
      // Unverified user — update their record and resend
      user.name = name;
      user.password = password; // pre-save hook will re-hash
      user.otp = hashedOtp;
      user.otpExpires = otpExpires;
      user.otpAttempts = 0;
      await user.save();
    } else {
      // Brand new user — create with isVerified=false
      user = new User({
        name,
        email,
        password,
        otp: hashedOtp,
        otpExpires,
        otpAttempts: 0,
        isVerified: false,
        profileComplete: false,
      });
      await user.save();
    }

    // Send the OTP email — if this fails, throw so the client knows
    await sendOtpEmail(email, name, plainOtp);

    return { message: 'OTP sent to your email address.' };
  },

  /**
   * Resend OTP for a pending registration without needing password.
   */
  async resendRegistrationOtp(email) {
    const user = await User.findOne({ email }).select('+otp');
    if (!user) {
      const err = new Error('No pending registration found for this email.');
      err.status = 404;
      throw err;
    }
    if (user.isVerified) {
      const err = new Error('This email is already verified. Please log in.');
      err.status = 409;
      throw err;
    }

    const plainOtp = generateOtp();
    const hashedOtp = await bcrypt.hash(plainOtp, 10);
    user.otp = hashedOtp;
    user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
    user.otpAttempts = 0;
    await user.save();

    await sendOtpEmail(email, user.name, plainOtp);
    return { message: 'A new verification code has been sent to your email.' };
  },

  /**
   * Step 2 — Verify the OTP. On success, mark email as verified and issue tokens.
   */
  async verifyRegistrationOtp(email, otp) {
    const user = await User.findOne({ email }).select('+otp');

    if (!user) {
      const err = new Error('No pending registration found for this email.');
      err.status = 404;
      throw err;
    }

    if (user.isVerified) {
      const err = new Error('This email is already verified. Please log in.');
      err.status = 409;
      throw err;
    }

    // Check expiry
    if (!user.otpExpires || user.otpExpires < new Date()) {
      const err = new Error('OTP has expired. Please request a new one.');
      err.status = 400;
      throw err;
    }

    // Check attempts
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      const err = new Error('Too many incorrect attempts. Please request a new OTP.');
      err.status = 429;
      throw err;
    }

    // Verify the OTP
    const isMatch = await bcrypt.compare(otp, user.otp || '');
    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();
      const remaining = OTP_MAX_ATTEMPTS - user.otpAttempts;
      const err = new Error(
        `Incorrect OTP. ${remaining > 0 ? `${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Please request a new OTP.'}`
      );
      err.status = 400;
      throw err;
    }

    // ── OTP correct ────────────────────────────────────────────────────────
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.profileComplete = false; // Will be set after profile screen
    await user.save();

    const tokens = generateTokens(user._id.toString());
    await storeRefreshToken(user, tokens.refreshToken);

    return { user, ...tokens };
  },

  // ── Profile Completion ──────────────────────────────────────────────────────

  /**
   * Save the health profile for a verified user.
   * Auto-calculates age from dateOfBirth.
   * @param {string} userId
   * @param {{ dateOfBirth, weight, height, bloodGroup, age }} profileData
   */
  async completeProfile(userId, profileData) {
    const { dateOfBirth, weight, height, bloodGroup } = profileData;

    let calculatedAge = profileData.age;
    let parsedDob = null;

    if (dateOfBirth) {
      parsedDob = new Date(dateOfBirth);
      if (isNaN(parsedDob.getTime())) {
        const err = new Error('Invalid date of birth provided.');
        err.status = 400;
        throw err;
      }

      const today = new Date();
      let age = today.getFullYear() - parsedDob.getFullYear();
      const m = today.getMonth() - parsedDob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < parsedDob.getDate())) {
        age--;
      }

      if (age < 1 || age > 120) {
        const err = new Error('Calculated age must be between 1 and 120 years.');
        err.status = 400;
        throw err;
      }
      calculatedAge = age;
    }

    const updateFields = {
      'profile.weight': weight,
      'profile.height': height,
      'profile.bloodGroup': bloodGroup,
      'profile.age': calculatedAge,
      profileComplete: true,
    };

    if (parsedDob) {
      updateFields['profile.dateOfBirth'] = parsedDob;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!user) {
      const err = new Error('User not found.');
      err.status = 404;
      throw err;
    }

    return { user };
  },

  // ── Google OAuth ────────────────────────────────────────────────────────────

  /**
   * Upsert a user from a Google OAuth profile.
   * Google accounts are considered email-verified automatically.
   * @param {{ id, emails, displayName, photos }} googleProfile
   */
  async googleLogin(googleProfile) {
    const email = googleProfile.emails?.[0]?.value;
    const name = googleProfile.displayName || 'Google User';
    const avatar = googleProfile.photos?.[0]?.value || null;
    const googleId = googleProfile.id;

    let user = await User.findOne({ googleId });

    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (user) {
      // Update Google fields if missing
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && avatar) user.avatar = avatar;
      if (!user.isVerified) user.isVerified = true; // Google confirms email
    } else {
      // Create new user — Google users are always verified
      user = new User({ name, email, googleId, avatar, isVerified: true, profileComplete: false });
      await user.save();
    }

    const tokens = generateTokens(user._id.toString());
    await storeRefreshToken(user, tokens.refreshToken);

    return { user, ...tokens };
  },

  // ── Token Management ────────────────────────────────────────────────────────

  /**
   * Rotate the refresh token — verify the old one, issue new pair.
   */
  async refreshTokens(incomingRefreshToken) {
    let payload;
    try {
      payload = jwt.verify(incomingRefreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      const err = new Error('Invalid or expired refresh token.');
      err.status = 401;
      throw err;
    }

    const user = await User.findById(payload.sub).select('+refreshToken');
    if (!user || !user.refreshToken) {
      const err = new Error('Session not found. Please log in again.');
      err.status = 401;
      throw err;
    }

    const tokenMatches = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
    if (!tokenMatches) {
      // Potential token reuse attack — clear stored token
      user.refreshToken = null;
      await user.save();
      const err = new Error('Token reuse detected. Please log in again.');
      err.status = 401;
      throw err;
    }

    const tokens = generateTokens(user._id.toString());
    await storeRefreshToken(user, tokens.refreshToken);

    return { user, ...tokens };
  },

  /**
   * Clear the refresh token (logout).
   */
  async logout(userId) {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  },
};

export default AuthService;
