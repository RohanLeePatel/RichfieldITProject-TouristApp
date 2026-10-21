const { logDevOtp } = require('../utils/otp');
const { httpError } = require('./tripAccessService');

// Sends verification and password-reset codes over SMTP. Any provider works
// (Gmail app password, Resend, SendGrid, Brevo, Supabase SMTP):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS, SMTP_FROM
// Without SMTP_HOST, codes are printed to the console outside production and
// refused in production, so a missing config fails loudly instead of leaving
// people waiting for an email that never comes.

const SUBJECTS = {
  verify: 'Your Roamio verification code',
  reset: 'Your Roamio password reset code',
};

const INTROS = {
  verify: 'Use this code to finish creating your Roamio account:',
  reset: 'Use this code to reset your Roamio password:',
};

let transporter;
const getTransporter = () => {
  if (!transporter) {
    // required lazily so local development without SMTP never loads it
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
};

const isConfigured = () => Boolean(process.env.SMTP_HOST);

// purpose: 'verify' | 'reset'. Throws a 503 when the code can't be delivered.
async function sendOtpEmail(email, otp, purpose = 'verify') {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SMTP_HOST is not set: cannot email verification codes.');
      throw httpError(503, 'Email delivery is not configured. Please try again later.');
    }
    logDevOtp(email, otp, purpose === 'reset' ? 'DEV RESET OTP' : 'DEV OTP');
    return;
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: SUBJECTS[purpose],
      text: `${INTROS[purpose]}\n\n${otp}\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.`,
    });
  } catch (error) {
    console.error('Failed to send OTP email:', error.message);
    throw httpError(503, 'Could not send the email. Please try again shortly.');
  }
}

module.exports = { sendOtpEmail, isConfigured };
