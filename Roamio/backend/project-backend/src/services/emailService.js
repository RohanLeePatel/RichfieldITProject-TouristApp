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

// A problem report from Settings, sent to the support inbox. Replies go to the
// traveller (replyTo). Same delivery rules as the codes: printed outside
// production when SMTP isn't set, a 503 in production.
const SUPPORT_EMAIL = () => process.env.SUPPORT_EMAIL || 'support.roamiio.live@gmail.com';

async function sendSupportReport({ reference, category, subject, description, fromEmail, fromName, context }) {
  const lines = [
    `Reference: ${reference}`,
    `From: ${fromName ? `${fromName} ` : ''}<${fromEmail}>`,
    `Category: ${category}`,
    '',
    description,
  ];
  if (context && Object.keys(context).length) {
    lines.push('', '---', ...Object.entries(context).map(([key, value]) => `${key}: ${value}`));
  }
  const message = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: SUPPORT_EMAIL(),
    replyTo: fromEmail,
    subject: `[${reference}] ${category}: ${subject}`,
    text: lines.join('\n'),
  };

  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error('SMTP_HOST is not set: cannot email problem reports.');
      throw httpError(503, 'Reports can not be sent right now. Please email us directly.');
    }
    console.log(`[DEV REPORT] ${message.subject}`);
    return;
  }
  try {
    await getTransporter().sendMail(message);
  } catch (error) {
    console.error('Failed to send problem report:', error.message);
    throw httpError(503, 'Could not send your report. Please try again shortly.');
  }
}

// Connects and authenticates against the SMTP server without sending anything
const verifyConnection = () => getTransporter().verify();

module.exports = { sendOtpEmail, sendSupportReport, isConfigured, verifyConnection };
