const rateLimit = require('express-rate-limit');

// Each limiter is keyed per client IP and applies its own window. Limits are set per
// feature, not globally, because the costly features (AI, translation, email) use
// external quotas that are shared by all users. One busy feature must not exhaust
// another, and a flood on one shouldn't block the rest of the app.

// Safety net for the whole API. Normal use should never reach it; it exists to stop
// runaway clients and scripts.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { message: 'Too many requests from this IP, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Mounted on /api/auth in server.js, except for the paths in UNLIMITED_AUTH_PATHS.
// Guards against credential stuffing and brute force. The limit is low because a real
// user rarely needs more than a few auth attempts in a minute.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// DeepL and OCR quotas are shared across all users, so one heavy user can use up the
// budget for everyone.
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many translation requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Each call reaches the AI service, which is the most expensive part of the backend.
const recommendationsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many recommendation requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// OpenWeather's quota is shared across all users.
const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many weather requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Every message spends the Gemini free-tier quota.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many chat messages, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Uses a longer window than the others. Each report sends an email to the support
// inbox, so this limit protects that inbox from spam.
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'You have sent several reports already. Please wait a few minutes before sending another.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Covers subscribe and the test-notification endpoint. A test sends a real push to the
// user's devices, so it is rate-limited like any other outbound message.
const pushLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  translateLimiter,
  recommendationsLimiter,
  weatherLimiter,
  chatLimiter,
  supportLimiter,
  pushLimiter
};