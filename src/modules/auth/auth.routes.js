const express = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

const authController = require('./controllers/auth.controller');
const authGuard = require('./auth.guard');
const AuthService = require('./service/auth.service');

const router = express.Router();

// ─── Passport Google Strategy ─────────────────────────────────────────────────
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID'
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const result = await AuthService.googleLogin(profile);
          done(null, result.user, {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
          });
        } catch (err) {
          done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

// ─── Email / Password routes ──────────────────────────────────────────────────

/** POST /api/auth/register — Legacy direct register (no OTP) */
router.post('/register', authController.register);

/** POST /api/auth/login */
router.post('/login', authController.login);

/** POST /api/auth/refresh */
router.post('/refresh', authController.refresh);

/** POST /api/auth/logout  (protected) */
router.post('/logout', authGuard, authController.logout);

/** GET /api/auth/me  (protected) */
router.get('/me', authGuard, authController.me);

// ─── OTP Registration Flow ────────────────────────────────────────────────────

/**
 * POST /api/auth/register/send-otp
 * Body: { name, email, password }
 * Creates a pending user and emails a 6-digit OTP.
 */
router.post('/register/send-otp', authController.sendOtp);

/**
 * POST /api/auth/register/resend-otp
 * Body: { email }
 * Resends a fresh OTP to pending user's email.
 */
router.post('/register/resend-otp', authController.resendOtp);

/**
 * POST /api/auth/register/verify-otp
 * Body: { email, otp }
 * Verifies the OTP and returns app tokens on success.
 */
router.post('/register/verify-otp', authController.verifyOtp);

// ─── Profile Completion ───────────────────────────────────────────────────────

/**
 * POST /api/auth/complete-profile  (protected)
 * Body: { age, weight, height, bloodGroup }
 * Saves health profile data. Requires a valid access token.
 */
router.post('/complete-profile', authGuard, authController.completeProfile);

// ─── Google OAuth Web flow ────────────────────────────────────────────────────

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_REDIRECT_URL}?error=google_auth_failed`,
  }),
  authController.googleCallback
);

// ─── Google OAuth Mobile flow ─────────────────────────────────────────────────

/** POST /api/auth/google/mobile — exchange Google idToken for app tokens */
router.post('/google/mobile', authController.googleMobileLogin);

module.exports = router;
