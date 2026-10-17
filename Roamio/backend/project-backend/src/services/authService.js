const userRepository = require('../repositories/userRepository');
const tokenService = require('../auth/tokenService');
const { generateOtp, hashOtp, otpExpiry, otpMatches, logDevOtp, MAX_OTP_ATTEMPTS } = require('../utils/otp');
const { httpError } = require('./tripAccessService');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_OTP = 'Invalid or expired OTP.';
const INVALID_RESET_CODE = 'Invalid or expired reset code.';
const MIN_PASSWORD_LENGTH = 8;

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// Issues a new code, stores only its hash, and returns the plain code for delivery
const issueOtp = async (userId, extra = {}) => {
  const otp = generateOtp();
  await userRepository.setOtp(userId, { otpHash: hashOtp(otp), otpExpiresAt: otpExpiry(), ...extra });
  return otp;
};

const toProfile = (user) => ({ id: user.id, email: user.email, fullName: user.fullName });

class AuthService {
  async register({ email, password, fullName } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw httpError(400, 'A valid email is required.');
    if (typeof password !== 'string' || password.length < 8) {
      throw httpError(400, 'Password must be at least 8 characters.');
    }
    if (typeof fullName !== 'string' || !fullName.trim()) throw httpError(400, 'Full name is required.');

    const passwordHash = await tokenService.hashPassword(password);
    const existing = await userRepository.findByEmail(normalizedEmail);

    let otp;
    if (existing) {
      if (existing.isVerified) throw httpError(409, 'Email already registered');
      // An unverified registration can be retried (e.g. lost code); only the inbox owner can finish it
      otp = await issueOtp(existing.id, { passwordHash, fullName: fullName.trim() });
    } else {
      otp = generateOtp();
      await userRepository.create({
        email: normalizedEmail,
        passwordHash,
        fullName: fullName.trim(),
        otpHash: hashOtp(otp),
        otpExpiresAt: otpExpiry(),
      });
    }

    logDevOtp(normalizedEmail, otp);
    return { email: normalizedEmail, otp };
  }

  async verifyOtp({ email, otp } = {}) {
    const user = await userRepository.findByEmail(normalizeEmail(email));
    // One generic error for unknown user, no/expired/exhausted code, or wrong code
    if (!user || user.isVerified || !user.otpHash || !user.otpExpiresAt
        || user.otpExpiresAt <= new Date() || user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(400, INVALID_OTP);
    }

    if (!otpMatches(otp, user.otpHash)) {
      await userRepository.recordFailedOtp(user.id, MAX_OTP_ATTEMPTS);
      throw httpError(400, INVALID_OTP);
    }

    if (!(await userRepository.markVerified(user.id, user.otpHash))) throw httpError(400, INVALID_OTP);

    return {
      user: toProfile(user),
      accessToken: tokenService.generateAccessToken(user),
      refreshToken: tokenService.generateRefreshToken(user),
    };
  }

  async resendOtp({ email } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw httpError(400, 'A valid email is required.');

    const user = await userRepository.findByEmail(normalizedEmail);
    if (user?.isVerified) throw httpError(400, 'Account is already verified.');

    // Unknown emails get the same response so this endpoint can't be used to probe for accounts
    if (user) logDevOtp(normalizedEmail, await issueOtp(user.id));
  }

  // Always resolves without revealing whether the email exists; returns the code only for a real account
  async forgotPassword({ email } = {}) {
    const normalizedEmail = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw httpError(400, 'A valid email is required.');

    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) return { otp: null };

    const otp = generateOtp();
    await userRepository.setResetPasswordOtp(user.id, hashOtp(otp), otpExpiry());
    logDevOtp(normalizedEmail, otp, 'DEV RESET OTP');
    return { otp };
  }

  async resetPassword({ email, otp, newPassword } = {}) {
    // Checked first so a too-short password doesn't burn an attempt or the code
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw httpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const user = await userRepository.findByEmail(normalizeEmail(email));
    if (!user || !user.resetPasswordOtpHash || !user.resetPasswordExpiresAt
        || user.resetPasswordExpiresAt <= new Date() || user.resetPasswordAttempts >= MAX_OTP_ATTEMPTS) {
      throw httpError(400, INVALID_RESET_CODE);
    }

    if (!otpMatches(otp, user.resetPasswordOtpHash)) {
      await userRepository.recordFailedResetAttempt(user.id, MAX_OTP_ATTEMPTS);
      throw httpError(400, INVALID_RESET_CODE);
    }

    const passwordHash = await tokenService.hashPassword(newPassword);
    const updated = await userRepository.updatePasswordAndClearResetOtp(user.id, passwordHash, user.resetPasswordOtpHash);
    if (!updated) throw httpError(400, INVALID_RESET_CODE);
  }

  async login({ email, password } = {}) {
    const user = typeof password === 'string' ? await userRepository.findByEmail(normalizeEmail(email)) : null;
    if (!user) throw httpError(401, 'Invalid email or password');

    const valid = await tokenService.comparePassword(password, user.passwordHash);
    if (!valid) throw httpError(401, 'Invalid email or password');

    if (!user.isVerified) throw httpError(403, 'Account not verified. Please verify your email first.');

    return {
      user: toProfile(user),
      accessToken: tokenService.generateAccessToken(user),
      refreshToken: tokenService.generateRefreshToken(user),
    };
  }

  async refreshTokens(refreshToken) {
    if (!refreshToken) throw httpError(401, 'Refresh token missing');

    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw httpError(403, 'Invalid or expired refresh token');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) throw httpError(404, 'User not found');
    if (!user.isVerified) throw httpError(403, 'Account not verified. Please verify your email first.');

    return {
      accessToken: tokenService.generateAccessToken(user),
      refreshToken: tokenService.generateRefreshToken(user),
    };
  }
}

module.exports = new AuthService();
