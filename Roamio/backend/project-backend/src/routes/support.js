const crypto = require('node:crypto');
const express = require('express');
const requireAuth = require('../middleware/authMiddleware');
const userRepository = require('../repositories/userRepository');
const { sendSupportReport } = require('../services/emailService');
const { httpError } = require('../services/tripAccessService');

const router = express.Router();

// Same list as the Settings page (REPORT_CATEGORIES in settingsContent.js)
const CATEGORIES = [
  "Something isn't working",
  'Booking or trip',
  'Account and sign-in',
  'Payments and expenses',
  'Translator',
  'Suggestion',
  'Other',
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// the only things the report may carry besides the words, each a short string
const CONTEXT_KEYS = ['page', 'browser', 'screen', 'language', 'time'];

const fail = (res, next, err) =>
  err.statusCode ? res.status(err.statusCode).json({ message: err.message }) : next(err);

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// POST /api/support/reports - "Report a problem" in Settings. Emailed to the
// support inbox; the reply comes back as { reference } for the traveller to quote.
router.post('/reports', requireAuth, async (req, res, next) => {
  try {
    const category = text(req.body?.category);
    const subject = text(req.body?.subject);
    const description = text(req.body?.description);
    if (!CATEGORIES.includes(category)) throw httpError(400, "Choose what it's about.");
    if (subject.length < 4 || subject.length > 120) throw httpError(400, 'Add a short summary (4-120 characters).');
    if (description.length < 20 || description.length > 4000) throw httpError(400, 'Tell us a little more (20-4000 characters).');

    // the account's own address, not whatever the form says: a report can't be sent in someone else's name
    const user = await userRepository.findById(req.user.userId);
    if (!user) throw httpError(404, 'Account not found.');
    const replyTo = EMAIL.test(text(req.body?.email)) ? text(req.body.email).slice(0, 254) : user.email;

    const context = {};
    for (const key of CONTEXT_KEYS) {
      const value = req.body?.context?.[key];
      if (typeof value === 'string' && value.trim()) context[key] = value.trim().slice(0, 200);
    }

    const reference = `RM-${crypto.randomInt(10000, 100000)}`;
    await sendSupportReport({ reference, category, subject, description, fromEmail: replyTo, fromName: user.fullName, context });
    res.status(201).json({ reference });
  } catch (err) {
    fail(res, next, err);
  }
});

module.exports = router;
