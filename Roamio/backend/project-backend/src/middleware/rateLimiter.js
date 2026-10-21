const rateLimit = require('express-rate-limit');

// General API limiter: 300 requests per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  message: { message: 'Too many requests from this IP, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter auth limiter: 10 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 10,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Translation limiter: 20 requests per minute (DeepL/OCR quota is shared by everyone)
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many translation requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  translateLimiter
};