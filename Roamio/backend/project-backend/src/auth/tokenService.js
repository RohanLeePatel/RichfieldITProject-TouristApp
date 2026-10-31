const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'access_secret_fallback';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_fallback';

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// sid: the session this token belongs to (see sessionService); signing a session
// out stops its refresh token being renewed.
const generateAccessToken = (user, sid) => {
  return jwt.sign(
    { userId: user.id, email: user.email, ...(sid ? { sid } : {}) },
    ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = (user, sid) => {
  return jwt.sign(
    { userId: user.id, ...(sid ? { sid } : {}) },
    REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, REFRESH_SECRET);
};

// The site (roamiio.live) and this API are different sites, so a Strict
// cookie never came back to /refresh and every session died with its 15-minute
// access token. None (which requires Secure) lets it; CORS still limits who can
// read the new token, and /refresh does nothing else.
const refreshCookieOptions = () => {
  const production = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: production, sameSite: production ? 'None' : 'Lax' };
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    ...refreshCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', refreshCookieOptions());
};

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};