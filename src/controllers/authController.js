const authService = require('../services/authService');
const tokenService = require('../auth/tokenService');
const userRepository = require('../repositories/userRepository');

class AuthController {
  async register(req, res, next) {
    try {
      const { user, accessToken, refreshToken } = await authService.register(req.body);
      
      // Set the refresh token using your service
      tokenService.setRefreshTokenCookie(res, refreshToken);
      
      // Set the access token in a signed cookie so you are logged in immediately
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        signed: true,
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.status(201).json({ user, accessToken });
    } catch (err) {
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      // Call your auth service to handle the login logic
      const { user, accessToken, refreshToken } = await authService.login(req.body);

      // Set the refresh token using your service
      tokenService.setRefreshTokenCookie(res, refreshToken);

      // Set the access token in a signed cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        signed: true,
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.status(200).json({
        message: 'Login successful',
        accessToken
      });
    } catch (err) {
      next(err);
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
      next(err);
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