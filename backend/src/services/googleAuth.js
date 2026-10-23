/**
 * googleAuth.js
 *
 * Verifies a Google ID token using google-auth-library.
 * This is the secure way — it validates the `aud` (audience) claim,
 * ensuring the token was issued for THIS application, not any other.
 *
 * Never use the raw tokeninfo endpoint for production — it does NOT
 * verify the audience, making it vulnerable to token injection.
 */

import { OAuth2Client } from 'google-auth-library';

// Use the Web Client ID to verify mobile-issued tokens.
// Google issues ID tokens with the Android client ID as `aud` when
// signing in natively, but the OAuth2Client accepts both web and
// Android client IDs in the audience list.
const WEB_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID; // optional

const client = new OAuth2Client(WEB_CLIENT_ID);

/**
 * Verifies a Google ID token and returns the payload.
 *
 * @param {string} idToken  — The ID token received from the mobile app.
 * @returns {Promise<{
 *   sub: string;
 *   email: string;
 *   name: string;
 *   picture: string | undefined;
 *   email_verified: boolean;
 * }>}
 * @throws {Error} if the token is invalid, expired, or wrong audience.
 */
export async function verifyGoogleIdToken(idToken) {
  // Build the audience list — include both web and android client IDs
  const audience = [WEB_CLIENT_ID];
  if (ANDROID_CLIENT_ID && ANDROID_CLIENT_ID !== 'YOUR_GOOGLE_ANDROID_CLIENT_ID') {
    audience.push(ANDROID_CLIENT_ID);
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience,
    });
  } catch (err) {
    const error = new Error('Google ID token verification failed: ' + err.message);
    error.status = 401;
    throw error;
  }

  const payload = ticket.getPayload();

  if (!payload) {
    const error = new Error('Google ID token payload is empty.');
    error.status = 401;
    throw error;
  }

  // Reject accounts with unverified email addresses
  if (!payload.email_verified) {
    const error = new Error('Google account email is not verified.');
    error.status = 403;
    throw error;
  }

  return {
    sub: payload.sub,                       // Google user ID
    email: payload.email,
    name: payload.name || 'Google User',
    picture: payload.picture || null,
    email_verified: payload.email_verified,
  };
}
