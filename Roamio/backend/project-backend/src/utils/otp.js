const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// Cryptographically secure 6-digit numeric code
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const otpExpiry = () => new Date(Date.now() + OTP_TTL_MS);

// Constant-time comparison of a submitted code against the stored hash
const otpMatches = (otp, storedHash) => {
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp) || !storedHash) return false;
  const submitted = Buffer.from(hashOtp(otp), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return submitted.length === stored.length && crypto.timingSafeEqual(submitted, stored);
};

// Stand-in for an email provider: prints the code outside production
const logDevOtp = (email, otp, label = 'DEV OTP') => {
  if (process.env.NODE_ENV !== 'production') console.log(`[${label}] ${email}:${otp}`);
};

module.exports = { generateOtp, hashOtp, otpExpiry, otpMatches, logDevOtp, MAX_OTP_ATTEMPTS };
