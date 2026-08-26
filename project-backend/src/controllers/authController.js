const authService = require('../services/authService');
const tokenService = require('../auth/tokenService');
const userRepository = require('../repositories/userRepository');

class AuthController {
  async register(req, res, next) {
    try {
      const { user, accessToken, refreshToken } = await authService.register(req.body);
      tokenService.setRefreshTokenCookie(res, refreshToken);
      res.status(201).json({ user, accessToken });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { user, accessToken, refreshToken } = await authService.login(req.body);
      tokenService.setRefreshTokenCookie(res, refreshToken);
      res.json({ user, accessToken });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req, res, next) {
    try {
      const token = req.cookies.refreshToken;
      const { accessToken, refreshToken: newRefreshToken } = await authService.refreshTokens(token);
      tokenService.setRefreshTokenCookie(res, newRefreshToken);
      res.json({ accessToken });
    } catch (err) {
      next(err);
    }
  }

  async logout(req, res) {
    tokenService.clearRefreshTokenCookie(res);
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