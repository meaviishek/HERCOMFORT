const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
  process.env.MAIL_CLIENT_ID,
  process.env.MAIL_CLIENT_SECRET,
  process.env.MAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.MAIL_REFRESH_TOKEN,
});

/**
 * Creates a fresh Nodemailer transporter with a new OAuth2 access token.
 * Called on every send so we never use an expired token (tokens expire ~1 hour).
 */
const createFreshTransporter = async () => {
  const tokenResponse = await oauth2Client.getAccessToken();
  const accessToken =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;

  if (!accessToken) {
    throw new Error(
      'Failed to obtain Gmail OAuth2 access token. Check MAIL_REFRESH_TOKEN env var.'
    );
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.MAIL_ADMINISTRATOR,
      clientId: process.env.MAIL_CLIENT_ID,
      clientSecret: process.env.MAIL_CLIENT_SECRET,
      refreshToken: process.env.MAIL_REFRESH_TOKEN,
      accessToken: accessToken,
    },
  });
};

module.exports = {
  createFreshTransporter,
  default: createFreshTransporter,
};
