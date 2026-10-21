const authService = require('../services/authService');
const tokenService = require('../auth/tokenService');
const userRepository = require('../repositories/userRepository');

// Expected errors (validation/auth) use the { error } shape; anything else goes to the global handler
const fail = (res, next, err) => {
  if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
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
      const { email, otp } = await authService.register(req.body);
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
      const { user, accessToken, refreshToken } = await authService.verifyOtp(req.body);
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
      const { user, accessToken, refreshToken } = await authService.login(req.body);
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
      // Assuming your refreshToken is unsigned in cookie-parser, otherwise use req.signedCookies
      const token = req.cookies.refreshToken || req.signedCookies.refreshToken;
      const { accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(token);
      
      tokenService.setRefreshTokenCookie(res, newRefreshToken);
      
      // Update the access token cookie too
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
    tokenService.clearRefreshTokenCookie(res);
    res.clearCookie('accessToken'); // Clear the access token too
    res.json({ message: 'Logged out successfully' });
  }

  async getMe(req, res, next) {
    try {
      const user = await userRepository.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (err) {
      next(err);
    }
  }

  async updateMe(req, res, next) {
    try {
      const updated = await userRepository.update(req.user.userId, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();