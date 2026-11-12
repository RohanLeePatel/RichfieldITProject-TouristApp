const crypto = require('node:crypto');
const userRepository = require('../repositories/userRepository');
const tokenService = require('../auth/tokenService');
const sessionService = require('./sessionService');
const { generateOtp, hashOtp, otpExpiry, otpMatches, issuedWithin, RESEND_COOLDOWN_MS, MAX_OTP_ATTEMPTS } = require('../utils/otp');

const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const { sendOtpEmail } = require('./emailService');
const { httpError } = require('./tripAccessService');
const { verifyCaptcha } = require('./captchaService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUSPENDED = 'This account has been suspended. Please contact support.';
const INVALID_OTP = 'Invalid or expired OTP.';
const INVALID_RESET_CODE = 'Invalid or expired reset code.';
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt ignores everything after 72 bytes
const COMMON_PASSWORDS = /^(password|passw0rd|qwerty|letmein|welcome|admin|iloveyou|abc123|123456)\d*[!@#$%^&*]*$/i;
// Returns '' when a new password is acceptable (length is checked by the callers).
const passwordWeakness = (p) => {
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p) || !/\d/.test(p)) {
    return 'Password needs an uppercase letter, a lowercase letter and a number.';
  }
  return COMMON_PASSWORDS.test(p) ? 'That password is too common. Choose something harder to guess.' : '';
};
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 80;
// the wording of the Terms and Privacy Policy users agree to when they sign up;
// keep equal to LEGAL_LAST_UPDATED in frontend/src/components/settings/settingsContent.js
const TERMS_VERSION = '2026-10-31';
// letters from any language, then spaces . ' - between them
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// ponytail: short disposable-domain list; swap for a maintained package if abuse continues
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'throwawaymail.com', 'sharklasers.com', 'getnada.com',
  'maildrop.cc', 'dispostable.com', 'fakeinbox.com',
]);

// True for disposable domains or domains that cannot receive mail.
// DNS timeouts/outages return false so a flaky resolver doesn't block sign-ups.
const hasFakeDomain = async (email) => {
  const domain = email.split('@').pop();
  if (DISPOSABLE_DOMAINS.has(domain) || /(?:^|\.)example\.(com|net|org)$|\.(example|invalid|localhost|test)$/.test(domain)) return true;
  const dnsP = require('node:dns').promises;
  const missing = (e) => e.code === 'ENOTFOUND' || e.code === 'ENODATA';
  try {
    const records = await dnsP.resolveMx(domain);
    // A null MX (RFC 7505) explicitly says the domain accepts no mail.
    if (records.length) return records.every(({ exchange }) => !exchange || exchange === '.');
  } catch (e) {
    if (!missing(e)) return false;
  }
  try {
    return (await dnsP.resolve4(domain)).length === 0; // no MX: mail falls back to the A record
  } catch (e) {
    return missing(e);
  }
};

// Issues a new code, stores only its hash, and returns the plain code for delivery
const issueOtp = async (userId, extra = {}) => {
  const otp = generateOtp();
  await userRepository.setOtp(userId, { otpHash: hashOtp(otp), otpExpiresAt: otpExpiry(), ...extra });
  return otp;
};

const toProfile = (user) => ({ id: user.id, email: user.email, fullName: user.fullName });

/**
 * Account lifecycle: registration, email verification, sign-in and token refresh,
 * and password reset. Controllers call these methods and map thrown httpErrors to
 * responses. Failure messages are kept deliberately generic where they would
 * otherwise reveal whether an email has an account.
 */
class AuthService {
  // Returns '' when the name is fine, otherwise the sentence to show. Shared by
  // registration and profile edits so both enforce the same rules.
  fullNameProblem(fullName) {
    const name = typeof fullName === 'string' ? fullName.trim() : '';
    if (name.length < 2 || name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
      return `Full name must be 2-${MAX_NAME_LENGTH} characters and use letters, spaces, hyphens, apostrophes and full stops only.`;
    }
    return '';
  }

  termsVersion = TERMS_VERSION;

  async acceptTerms(userId) {
    return await userRepository.acceptTerms(userId, TERMS_VERSION);
  }

  async register({ email, password, fullName, acceptedTerms, captchaToken } = {}, { ip } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > MAX_EMAIL_LENGTH) {
      throw httpError(400, 'A valid email is required.');
    }
    if (normalizedEmail === 'chicken@chicken.com' || await hasFakeDomain(normalizedEmail)) {
      throw Object.assign(httpError(400, 'Enter an email address where you can receive a verification code.'), {
        code: 'INVALID_REGISTRATION_EMAIL',
      });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw httpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      throw httpError(400, `Password can't be longer than ${MAX_PASSWORD_LENGTH} characters.`);
    }
    if (passwordWeakness(password)) throw httpError(400, passwordWeakness(password));
    if (typeof fullName !== 'string' || !fullName.trim()) throw httpError(400, 'Full name is required.');
    const nameProblem = this.fullNameProblem(fullName);
    if (nameProblem) throw httpError(400, nameProblem);

    if (acceptedTerms !== true) throw httpError(400, 'Please agree to the Terms and Privacy Policy to create an account.');

    // after the cheap field checks (so a typo doesn't burn the single-use token
    // for nothing) and before anything is stored or emailed
    await verifyCaptcha(captchaToken, ip);

    const passwordHash = await tokenService.hashPassword(password);
    const consent = { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION };
    const existing = await userRepository.findByEmail(normalizedEmail);

    let otp;
    if (existing) {
      if (existing.isVerified) throw httpError(409, 'Email already registered');
      // An unverified registration can be retried (e.g. lost code); only the inbox owner can finish it.
      // The stored password and name are kept: letting a second registration replace them would let
      // anyone who typed the victim's email choose the password the victim then verifies.
      otp = await issueOtp(existing.id, consent);
    } else {
      otp = generateOtp();
      await userRepository.create({
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        otpHash: hashOtp(otp),
        otpExpiresAt: otpExpiry(),
        ...consent,
      });
    }

    await sendOtpEmail(normalizedEmail, otp, 'verify');
    return { email: normalizedEmail, otp };
  }

  // Completes registration. `req` is passed through so the new session records the
  // device. Only the first successful code verifies the account, so a leaked code
  // can't be replayed after it has been used.
  async verifyOtp({ email, otp } = {}, req) {
    const user = await userRepository.findByEmail(normalizeEmail(email));
    // One generic error for unknown user, no/expired/exhausted code, or wrong code
    if (!user || user.isVerified || !user.otpHash || !user.otpExpiresAt
        || user.otpExpiresAt <= new Date() || user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(400, INVALID_OTP);
    }

    // the guess is spent before comparing, atomically, so parallel requests can't exceed the limit
    if (!(await userRepository.claimOtpAttempt(user.id, MAX_OTP_ATTEMPTS)) || !otpMatches(otp, user.otpHash)) {
      throw httpError(400, INVALID_OTP);
    }

    if (!(await userRepository.markVerified(user.id, user.otpHash))) throw httpError(400, INVALID_OTP);

    const sid = await sessionService.start(user.id, req);
    return {
      user: toProfile(user),
      accessToken: tokenService.generateAccessToken(user, sid),
      refreshToken: tokenService.generateRefreshToken(user, sid),
    };
  }

  async resendOtp({ email } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw httpError(400, 'A valid email is required.');

    const user = await userRepository.findByEmail(normalizedEmail);
    if (user?.isVerified) throw httpError(400, 'Account is already verified.');

    // Unknown emails get the same response so this endpoint can't be used to probe for accounts.
    // A failed send is logged, not returned, for the same reason.
    // within the cooldown nothing is sent, and the answer is the same as for an unknown email
    if (user && !issuedWithin(user.otpExpiresAt, RESEND_COOLDOWN_MS)) {
      await sendOtpEmail(normalizedEmail, await issueOtp(user.id), 'verify').catch(() => {});
    }
  }

  // Always resolves the same way whether or not the email exists. The plain code is
  // returned only for a real account, and only so the non-production path can show
  // it. Real delivery goes through email.
  async forgotPassword({ email } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw httpError(400, 'A valid email is required.');

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user || issuedWithin(user.resetPasswordExpiresAt, RESEND_COOLDOWN_MS)) return { otp: null };

    const otp = generateOtp();
    await userRepository.setResetPasswordOtp(user.id, hashOtp(otp), otpExpiry());
    // logged, not returned: an error only for real accounts would reveal which emails exist
    try {
      await sendOtpEmail(normalizedEmail, otp, 'reset');
    } catch {
      // undeliverable: drop the code so the 60s cooldown doesn't block the user's retry
      await userRepository.setResetPasswordOtp(user.id, null, null);
      return { otp: null };
    }
    return { otp };
  }

  // Sets a new password after a valid reset code. Every session is revoked on success.
  async resetPassword({ email, otp, newPassword } = {}) {
    // Checked before the code, so a bad password doesn't use up one of the code's attempts.
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw httpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      throw httpError(400, `Password can't be longer than ${MAX_PASSWORD_LENGTH} characters.`);
    }
    if (passwordWeakness(newPassword)) throw httpError(400, passwordWeakness(newPassword));

    const user = await userRepository.findByEmail(normalizeEmail(email));
    if (!user || !user.resetPasswordOtpHash || !user.resetPasswordExpiresAt
        || user.resetPasswordExpiresAt <= new Date() || user.resetPasswordAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(400, INVALID_RESET_CODE);
    }

    if (!(await userRepository.claimResetAttempt(user.id, MAX_OTP_ATTEMPTS)) || !otpMatches(otp, user.resetPasswordOtpHash)) {
      throw httpError(400, INVALID_RESET_CODE);
    }

    const passwordHash = await tokenService.hashPassword(newPassword);
    const updated = await userRepository.updatePasswordAndClearResetOtp(user.id, passwordHash, user.resetPasswordOtpHash);
    if (!updated) throw httpError(400, INVALID_RESET_CODE);
    // whoever knew the old password must not stay signed in
    await sessionService.revokeAll(user.id);
  }

  async login({ email, password } = {}, req) {
    const user = typeof password === 'string' ? await userRepository.findByEmail(normalizeEmail(email)) : null;
    if (!user) throw httpError(401, 'Invalid email or password');

    // checked before the password, so a locked account refuses even the right one
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw httpError(429, 'Too many failed sign-in attempts. Try again in a few minutes, or reset your password.');
    }

    const valid = await tokenService.comparePassword(password, user.passwordHash);
    if (!valid) {
      await userRepository.recordFailedLogin(user.id, MAX_LOGIN_FAILURES, LOGIN_LOCK_MS).catch((error) => console.error('Could not count a failed sign-in:', error.message));
      // shown to the account's owner under "Login activity"; never blocks the answer
      await sessionService.recordFailure(user.id, req).catch((error) => console.error('Could not record a failed sign-in:', error.message));
      throw httpError(401, 'Invalid email or password');
    }

    if (user.failedLogins > 0) await userRepository.clearFailedLogins(user.id);
    if (user.isActive === false) throw httpError(403, SUSPENDED);
    if (!user.isVerified) throw httpError(403, 'Account not verified. Please verify your email first.');

    const sid = await sessionService.start(user.id, req);
    return {
      user: toProfile(user),
      accessToken: tokenService.generateAccessToken(user, sid),
      refreshToken: tokenService.generateRefreshToken(user, sid),
    };
  }

  // Issues a fresh access and refresh token pair, provided the session is still live.
  // Tokens minted before sessions existed have no `sid`. They are given one here so
  // they appear in Settings and can be signed out like any other.
  async refreshTokens(refreshToken, req) {
    if (!refreshToken) throw httpError(401, 'Refresh token missing');

    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw httpError(403, 'Invalid or expired refresh token');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) throw httpError(404, 'User not found');
    if (user.isActive === false) throw httpError(403, SUSPENDED);
    if (!user.isVerified) throw httpError(403, 'Account not verified. Please verify your email first.');

    let sid = payload.sid;
    const jti = crypto.randomUUID();
    if (sid) {
      // signed out from Settings (or unused for a week): no new tokens. A refresh token that
      // was already used is refused too, and a replay from elsewhere ends the session.
      const outcome = await sessionService.rotate(sid, user.id, payload.jti, jti);
      if (outcome === 'replay') throw httpError(401, 'This refresh token was already used. Please sign in again.');
      if (outcome !== 'ok') throw httpError(401, 'This session was signed out. Please sign in again.');
    } else {
      // a token from before sessions existed: give it one, so it shows up and can be signed out
      sid = await sessionService.start(user.id, req, { record: false });
    }

    return {
      accessToken: tokenService.generateAccessToken(user, sid),
      refreshToken: tokenService.generateRefreshToken(user, sid, sid === payload.sid ? jti : undefined),
    };
  }

  // Sign out: ends the session the refresh cookie belongs to. Best effort - an
  // expired or missing cookie just means there is nothing left to end.
  async signOut(refreshToken) {
    if (!refreshToken) return;
    try {
      const { userId, sid } = tokenService.verifyRefreshToken(refreshToken);
      if (sid) await sessionService.revoke(userId, sid);
    } catch {
      // already over
    }
  }
}

module.exports = new AuthService();
