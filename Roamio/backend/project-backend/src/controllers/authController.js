const authService = require('../services/authService');
const tokenService = require('../auth/tokenService');
const userRepository = require('../repositories/userRepository');
const { isAdminUser } = require('../middleware/isAdmin');

// Expected errors (validation/auth) use the { error } shape; anything else goes to the global handler
const fail = (res, next, err) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, ...(err.code && { code: err.code }) });
  return next(err);
};

const setSession = (res, accessToken, refreshToken) => {
  tokenService.setRefreshTokenCookie(res, refreshToken);
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    signed: true,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
};

class AuthController {
  // No session is issued here: the account must verify its email first
  async register(req, res, next) {
    try {
      const { email, otp } = await authService.register(req.body, { ip: req.ip });
      res.status(201).json({
        message: 'Registration successful. Please verify the code sent to your email.',
        email,
        // Only exposed when explicitly enabled; never inferred from NODE_ENV
        devOtp: process.env.ENABLE_DEV_OTP === 'true' ? otp : undefined
      });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { user, accessToken, refreshToken } = await authService.verifyOtp(req.body, req);
      setSession(res, accessToken, refreshToken);
      // token: the name the frontend stores (same value as accessToken)
      res.status(200).json({ message: 'Email verified successfully.', user, accessToken, token: accessToken });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async resendOtp(req, res, next) {
    try {
      await authService.resendOtp(req.body);
      res.status(200).json({ message: 'New OTP sent.' });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { otp } = await authService.forgotPassword(req.body);
      res.status(200).json({
        message: 'If an account exists with that email, a reset code has been sent.',
        // Only exposed when explicitly enabled; never inferred from NODE_ENV
        devOtp: otp && process.env.ENABLE_DEV_OTP === 'true' ? otp : undefined
      });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      await authService.resetPassword(req.body);
      res.status(200).json({
        message: 'Password has been successfully reset. Please log in with your new password.'
      });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async login(req, res, next) {
    try {
      const { user, accessToken, refreshToken } = await authService.login(req.body, req);
      setSession(res, accessToken, refreshToken);
      res.status(200).json({
        message: 'Login successful',
        user,
        accessToken,
        token: accessToken // the name the frontend stores
      });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async refresh(req, res, next) {
    try {
      // The refresh cookie is set plain, but we accept a signed one too, so a cookie
      // from either setup still works.
      const token = req.cookies.refreshToken || req.signedCookies.refreshToken;
      const { accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(token, req);
      
      tokenService.setRefreshTokenCookie(res, newRefreshToken);
      // The access token cookie is refreshed alongside the refresh token
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        signed: true,
        maxAge: 15 * 60 * 1000
      });

      res.json({ accessToken });
    } catch (err) {
      fail(res, next, err);
    }
  }

  async logout(req, res) {
    await authService.signOut(req.cookies?.refreshToken || req.signedCookies?.refreshToken);
    tokenService.clearRefreshTokenCookie(res);
    res.clearCookie('accessToken'); // Clear the access token too
    res.json({ message: 'Logged out successfully' });
  }

  async getMe(req, res, next) {
    try {
      const user = await userRepository.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json({
        ...user,
        isAdmin: isAdminUser({ id: req.user.userId, role: req.user.role }),
        // the wording in force; the app asks anyone on an older version to agree again
        currentTermsVersion: authService.termsVersion
      });
    } catch (err) {
      next(err);
    }
  }

  async acceptTerms(req, res, next) {
    try {
      res.json(await authService.acceptTerms(req.user.userId));
    } catch (err) {
      next(err);
    }
  }

  async updateMe(req, res, next) {
    try {
      const data = profileUpdate(req.body);
      if (!data) return res.status(400).json({ message: 'Nothing to update.' });
      const updated = await userRepository.update(req.user.userId, data);
      res.json(updated);
    } catch (err) {
      if (err.statusCode === 400) return res.status(400).json({ message: err.message, error: err.message });
      next(err);
    }
  }
}

// Whitelist for PATCH /users/me. Anything not listed here is ignored, so a client
// can't set fields like passwordHash or isVerified. Email and password have their
// own verified flows and can't be changed here.
const PREFERENCE_FIELDS = { currency: 'string', language: 'string', theme: 'string', emailAlerts: 'boolean', pushAlerts: 'boolean' };

function profileUpdate(body = {}) {
  const data = {};
  if (body.fullName !== undefined) {
    const problem = authService.fullNameProblem(body.fullName);
    if (problem) throw Object.assign(new Error(problem), { statusCode: 400 });
    data.fullName = body.fullName.trim();
  }
  if (body.avatarUrl === null || (typeof body.avatarUrl === 'string' && /^https:\/\//.test(body.avatarUrl))) {
    data.avatarUrl = body.avatarUrl;
  }
  const prefs = Object.fromEntries(
    Object.entries(body.preferences || {}).filter(([key, value]) => typeof value === PREFERENCE_FIELDS[key])
  );
  if (Object.keys(prefs).length) data.preferences = { upsert: { create: prefs, update: prefs } };
  return Object.keys(data).length ? data : null;
}

module.exports = new AuthController();
module.exports.profileUpdate = profileUpdate;