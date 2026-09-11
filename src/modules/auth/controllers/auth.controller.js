import AuthService from '../service/auth.service.js';
import { verifyGoogleIdToken } from '../../../services/googleAuth.js';

/**
 * Standard JSON response helper
 */
function respond(res, status, success, message, data = {}) {
  return res.status(status).json({ success, message, ...data });
}

// ─── Email / Password (Legacy direct register) ────────────────────────────────

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 * Direct register without OTP — kept for backward compatibility.
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return respond(res, 400, false, 'name, email and password are required.');
    }
    if (password.length < 6) {
      return respond(res, 400, false, 'Password must be at least 6 characters.');
    }

    const { user, accessToken, refreshToken } = await AuthService.register(name, email, password);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return respond(res, 201, true, 'Account created successfully.', {
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return respond(res, 400, false, 'email and password are required.');
    }

    const { user, accessToken, refreshToken } = await AuthService.login(email, password);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return respond(res, 200, true, 'Login successful.', {
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Body: { refreshToken } OR cookie
 */
async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return respond(res, 401, false, 'Refresh token is required.');
    }

    const { user, accessToken, refreshToken } = await AuthService.refreshTokens(token);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return respond(res, 200, true, 'Token refreshed.', {
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Requires: auth guard
 */
async function logout(req, res, next) {
  try {
    await AuthService.logout(req.user._id.toString());

    res.clearCookie('refreshToken');
    return respond(res, 200, true, 'Logged out successfully.');
  } catch (err) {
    next(err);
  }
}

// ─── OTP Registration Flow ────────────────────────────────────────────────────

/**
 * POST /api/auth/register/send-otp
 * Body: { name, email, password }
 *
 * Creates a pending user and sends a 6-digit OTP to their email.
 */
async function sendOtp(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return respond(res, 400, false, 'name, email and password are required.');
    }
    if (password.length < 6) {
      return respond(res, 400, false, 'Password must be at least 6 characters.');
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return respond(res, 400, false, 'Please enter a valid email address.');
    }

    const result = await AuthService.sendRegistrationOtp(
      name.trim(),
      email.trim().toLowerCase(),
      password
    );

    return respond(res, 200, true, result.message);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register/resend-otp
 * Body: { email }
 */
async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return respond(res, 400, false, 'Email is required.');
    }

    const result = await AuthService.resendRegistrationOtp(email.trim().toLowerCase());
    return respond(res, 200, true, result.message);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/register/verify-otp
 * Body: { email, otp }
 *
 * Verifies the OTP. On success, marks email as verified and returns app tokens.
 */
async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return respond(res, 400, false, 'email and otp are required.');
    }

    const { user, accessToken, refreshToken } = await AuthService.verifyRegistrationOtp(
      email.trim().toLowerCase(),
      String(otp).trim()
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return respond(res, 200, true, 'Email verified successfully.', {
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Profile Completion ───────────────────────────────────────────────────────

/**
 * POST /api/auth/complete-profile
 * Requires: auth guard
 * Body: { dateOfBirth, weight, height, bloodGroup, age? }
 *
 * Saves health profile data and marks profileComplete = true.
 */
async function completeProfile(req, res, next) {
  try {
    const { dateOfBirth, dob, age, weight, height, bloodGroup } = req.body;
    const effectiveDob = dateOfBirth || dob;

    if ((!effectiveDob && !age) || !weight || !height || !bloodGroup) {
      return respond(
        res,
        400,
        false,
        'Date of birth, weight, height and blood group are required.'
      );
    }

    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    if (!validBloodGroups.includes(bloodGroup)) {
      return respond(
        res,
        400,
        false,
        `Invalid blood group. Must be one of: ${validBloodGroups.join(', ')}`
      );
    }

    const { user } = await AuthService.completeProfile(req.user._id.toString(), {
      dateOfBirth: effectiveDob,
      age: age ? Number(age) : undefined,
      weight: Number(weight),
      height: Number(height),
      bloodGroup,
    });

    return respond(res, 200, true, 'Profile completed successfully.', { user });
  } catch (err) {
    next(err);
  }
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────

/**
 * GET /api/auth/google/callback
 */
function googleCallback(req, res) {
  const { accessToken, refreshToken, user } = req.authInfo || {};

  if (!accessToken) {
    return res.redirect(`${process.env.CLIENT_REDIRECT_URL}?error=auth_failed`);
  }

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const redirectUrl = `${process.env.CLIENT_REDIRECT_URL}?accessToken=${accessToken}&userId=${user._id}`;
  return res.redirect(redirectUrl);
}

/**
 * POST /api/auth/google/mobile
 * Body: { idToken }
 */
async function googleMobileLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return respond(res, 400, false, 'idToken is required.');
    }

    let googlePayload;
    try {
      googlePayload = await verifyGoogleIdToken(idToken);
    } catch (verifyErr) {
      console.warn('[Auth] Google token verification failed:', verifyErr.message);
      return respond(res, verifyErr.status || 401, false, verifyErr.message);
    }

    const googleProfile = {
      id: googlePayload.sub,
      displayName: googlePayload.name,
      emails: [{ value: googlePayload.email }],
      photos: googlePayload.picture ? [{ value: googlePayload.picture }] : [],
    };

    const { user, accessToken, refreshToken } = await AuthService.googleLogin(googleProfile);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return respond(res, 200, true, 'Google login successful.', {
      user,
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user. Requires auth guard.
 */
function me(req, res) {
  return respond(res, 200, true, 'User fetched.', { user: req.user });
}

export default {
  register,
  login,
  refresh,
  logout,
  sendOtp,
  resendOtp,
  verifyOtp,
  completeProfile,
  googleCallback,
  googleMobileLogin,
  me,
};
