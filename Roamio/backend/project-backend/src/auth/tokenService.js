const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// The fallback secrets let local development run without setup. They are public
// strings, so anyone could forge tokens with them. Production must set both variables.
// In production a missing secret stops the server at boot instead of falling back.
const secretFor = (name, fallback) => {
  if (process.env[name]) return process.env[name];
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be set in production`);
  return fallback;
};
const ACCESS_SECRET = secretFor('JWT_ACCESS_SECRET', 'access_secret_fallback');
const REFRESH_SECRET = secretFor('JWT_REFRESH_SECRET', 'refresh_secret_fallback');

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

// jti: which refresh token this is. The session stores the latest one, so a token that has
// already been used is recognised as a replay (see sessionService.rotate).
const generateRefreshToken = (user, sid, jti) => {
  return jwt.sign(
    { userId: user.id, ...(sid ? { sid } : {}), ...(jti ? { jti } : {}) },
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

const setAccessTokenCookie = (res, token) => {
  res.cookie('accessToken', token, {
    ...refreshCookieOptions(),
    signed: true,
    maxAge: 15 * 60 * 1000,
  });
};

const clearAccessTokenCookie = (res) => res.clearCookie('accessToken', refreshCookieOptions());

module.exports = {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  setAccessTokenCookie,
  clearAccessTokenCookie,
};
