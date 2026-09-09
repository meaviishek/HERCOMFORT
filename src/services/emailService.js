const { createFreshTransporter } = require('../config/mail.config');

// ─── Email Templates ──────────────────────────────────────────────────────────

function otpEmailHtml(name, otp, email) {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff5b83 0%, #ff8da6 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                HerComfort
              </h1>
              <p style="margin: 6px 0 0 0; color: #fff0f3; font-size: 14px; font-weight: 500;">
                Personal Health & Wellness Companion
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <p style="margin: 0 0 16px 0; color: #1e293b; font-size: 17px; font-weight: 600;">
                Hello ${name || 'there'},
              </p>
              
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                Thank you for creating an account with HerComfort. To verify your email address (<strong>${email}</strong>), please enter this single-use security code:
              </p>

              <!-- OTP Code Cell -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="background-color: #fff1f4; border: 2px dashed #ff5b83; border-radius: 12px; padding: 20px 10px;">
                    <div style="font-family: 'Courier New', Courier, monospace, monospace; font-size: 38px; font-weight: 800; color: #ff5b83; letter-spacing: 8px; line-height: 1;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-align: center;">
                ⏱ This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.
              </p>

              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  If you did not request this verification code, someone may have entered your email by mistake. You can safely disregard this message.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                © ${currentYear} HerComfort. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send a 6-digit OTP with maximum priority and anti-spam headers.
 * @param {string} email - recipient email address
 * @param {string} name  - recipient's name
 * @param {string} otp   - 6-digit verification code
 */
async function sendOtpEmail(email, name, otp) {
  const adminEmail = process.env.MAIL_ADMINISTRATOR || 'no-reply@hercomfort.com';
  const from = `"HerComfort Security" <${adminEmail}>`;

  const transporter = await createFreshTransporter();

  const mailOptions = {
    from,
    to: email,
    replyTo: adminEmail,
    sender: adminEmail,
    envelope: {
      from: adminEmail,
      to: email,
    },
    // Subject line optimized: avoids leading numbers which trigger spam filters
    subject: `HerComfort Verification Code: ${otp}`,
    // Priority and importance headers for high-deliverability
    priority: 'high',
    headers: {
      'X-Priority': '1 (Highest)',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
      'X-Message-Delivery': 'high',
      'Auto-Submitted': 'auto-generated',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'List-Unsubscribe': `<mailto:${adminEmail}?subject=unsubscribe>`,
    },
    // Clean, complete plain-text fallback (crucial for spam score reduction)
    text: `Hello ${name || 'there'},\n\nYour HerComfort verification code is: ${otp}\n\nThis security code expires in 10 minutes.\n\nIf you did not sign up for HerComfort, you can safely ignore this email.\n\nBest regards,\nHerComfort Team`,
    html: otpEmailHtml(name, otp, email),
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[Email] High-priority OTP sent to ${email} — messageId: ${info.messageId}`);
  return info;
}

module.exports = { sendOtpEmail };
