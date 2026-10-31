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

// Recommendations/landmarks limiter: 30 requests per minute (hits the AI service)
const recommendationsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many recommendation requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Weather limiter: 60 requests per minute (shared OpenWeather quota)
const weatherLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many weather requests, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat limiter: 20 messages per minute (each one spends the free Gemini quota)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { message: 'Too many chat messages, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Problem reports: 5 per 15 minutes (each one sends an email)
const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'You have sent several reports already. Please wait a few minutes before sending another.' },
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
  supportLimiter
};