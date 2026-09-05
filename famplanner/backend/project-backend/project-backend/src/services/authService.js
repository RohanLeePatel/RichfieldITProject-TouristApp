const userRepository = require('../repositories/userRepository');
const tokenService = require('../auth/tokenService');

class AuthService {
  async register({ email, password, fullName }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await tokenService.hashPassword(password);
    const user = await userRepository.create({ email, passwordHash, fullName });

    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const valid = await tokenService.comparePassword(password, user.passwordHash);
    if (!valid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const accessToken = tokenService.generateAccessToken(user);
    const refreshToken = tokenService.generateRefreshToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(refreshToken) {
    if (!refreshToken) {
      const error = new Error('Refresh token missing');
      error.statusCode = 401;
      throw error;
    }

    let payload;
    try {
      payload = tokenService.verifyRefreshToken(refreshToken);
    } catch {
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 403;
      throw error;
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const newAccessToken = tokenService.generateAccessToken(user);
    const newRefreshToken = tokenService.generateRefreshToken(user);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
}

module.exports = new AuthService();