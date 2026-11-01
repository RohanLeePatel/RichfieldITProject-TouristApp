const crypto = require('node:crypto');
const express = require('express');
const prisma = require('../config/prisma');
const requireAuth = require('../middleware/authMiddleware');
const tokenService = require('../auth/tokenService');
const sessionService = require('../services/sessionService');
const accountService = require('../services/accountService');
const { toRow, toTraveller, MAX_TRAVELLERS } = require('../services/travellerService');
const { httpError } = require('../services/tripAccessService');

// The Settings page's endpoints (SETTINGS_API.md), all under the signed-in
// traveller: /api/users/me/...  Every query is filtered by the token's user id.
const router = express.Router();
router.use(requireAuth);

// Personal data: never cache it anywhere.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Expected problems answer { message } (what the page shows); anything else is
// logged and answers a plain 500 in the same shape.
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    console.error('Settings API error:', err.message);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

/* ---------------- notification preferences ---------------- */

const TOPICS = ['bookingConfirmations', 'travelUpdates', 'flightChanges', 'accommodationChanges'];
const DEFAULT_PREFS = {
  channels: { email: true, browser: false },
  topics: Object.fromEntries(TOPICS.map((topic) => [topic, { email: true, browser: true }])),
};

const flag = (value, fallback, label) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw httpError(400, `${label} must be true or false.`);
  return value;
};

// the body, completed with defaults; anything that isn't a yes/no is refused
function cleanPrefs(body) {
  if (!body || typeof body !== 'object') throw httpError(400, 'Send the notification preferences as JSON.');
  return {
    channels: {
      email: flag(body.channels?.email, DEFAULT_PREFS.channels.email, 'channels.email'),
      browser: flag(body.channels?.browser, DEFAULT_PREFS.channels.browser, 'channels.browser'),
    },
    topics: Object.fromEntries(
      TOPICS.map((topic) => [
        topic,
        {
          email: flag(body.topics?.[topic]?.email, true, `${topic}.email`),
          browser: flag(body.topics?.[topic]?.browser, true, `${topic}.browser`),
        },
      ])
    ),
  };
}

router.get('/notification-preferences', handle(async (req, res) => {
  const row = await prisma.notificationPreference.findUnique({ where: { userId: req.user.userId } });
  res.json(row ? cleanPrefs(row.prefs) : DEFAULT_PREFS);
}));

router.put('/notification-preferences', handle(async (req, res) => {
  const prefs = cleanPrefs(req.body);
  await prisma.notificationPreference.upsert({
    where: { userId: req.user.userId },
    create: { userId: req.user.userId, prefs },
    update: { prefs },
  });
  res.json(prefs);
}));

/* ---------------- trip planner draft ---------------- */

// The unfinished plan from the recommendations planner, so it follows the
// traveller to another device. One row each; the page owns the shape, we only
// check it is an object of sane size.
const MAX_DRAFT_BYTES = 1_000_000;

router.get('/planner-draft', handle(async (req, res) => {
  const row = await prisma.plannerDraft.findUnique({ where: { userId: req.user.userId } });
  res.json({ draft: row ? row.data : null });
}));

router.put('/planner-draft', handle(async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw httpError(400, 'Send the draft as an object.');
  if (Buffer.byteLength(JSON.stringify(data)) > MAX_DRAFT_BYTES) throw httpError(413, 'That draft is too large to keep.');
  await prisma.plannerDraft.upsert({
    where: { userId: req.user.userId },
    create: { userId: req.user.userId, data },
    update: { data },
  });
  res.json({ ok: true });
}));

router.delete('/planner-draft', handle(async (req, res) => {
  await prisma.plannerDraft.deleteMany({ where: { userId: req.user.userId } });
  res.json({ ok: true });
}));

/* ---------------- sessions and sign-in history ---------------- */

router.get('/sessions', handle(async (req, res) => {
  res.json(await sessionService.list(req.user.userId, req.user.sid));
}));

// before /sessions/:id, which would read "others" as an id
router.delete('/sessions/others', handle(async (req, res) => {
  await sessionService.revokeOthers(req.user.userId, req.user.sid);
  res.status(204).end();
}));

router.delete('/sessions/:id', handle(async (req, res) => {
  if (!(await sessionService.revoke(req.user.userId, req.params.id))) throw httpError(404, 'That session is already signed out.');
  res.status(204).end();
}));

router.get('/login-activity', handle(async (req, res) => {
  res.json(await sessionService.activity(req.user.userId));
}));

/* ---------------- saved travellers ---------------- */

const ownTraveller = (req) => prisma.savedTraveller.findFirst({ where: { id: req.params.id, userId: req.user.userId } });

router.get('/travellers', handle(async (req, res) => {
  const rows = await prisma.savedTraveller.findMany({ where: { userId: req.user.userId }, orderBy: { createdAt: 'asc' } });
  res.json(rows.map(toTraveller));
}));

router.post('/travellers', handle(async (req, res) => {
  const data = toRow(req.body);
  const userId = req.user.userId;
  if ((await prisma.savedTraveller.count({ where: { userId } })) >= MAX_TRAVELLERS) {
    throw httpError(400, `You can save up to ${MAX_TRAVELLERS} travellers.`);
  }
  const row = await prisma.savedTraveller.create({ data: { id: crypto.randomUUID(), userId, ...data } });
  res.status(201).json(toTraveller(row));
}));

router.put('/travellers/:id', handle(async (req, res) => {
  const existing = await ownTraveller(req);
  if (!existing) throw httpError(404, 'Traveller not found.');
  const row = await prisma.savedTraveller.update({ where: { id: existing.id }, data: { ...toRow(req.body, existing), updatedAt: new Date() } });
  res.json(toTraveller(row));
}));

router.delete('/travellers/:id', handle(async (req, res) => {
  const { count } = await prisma.savedTraveller.deleteMany({ where: { id: req.params.id, userId: req.user.userId } });
  if (!count) throw httpError(404, 'Traveller not found.');
  res.status(204).end();
}));

/* ---------------- download my data, delete my account ---------------- */

router.get('/export', handle(async (req, res) => {
  const data = await accountService.exportData(req.user.userId);
  res.set('Content-Disposition', `attachment; filename="roamio-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
}));

router.delete('/', handle(async (req, res) => {
  await accountService.deleteAccount(req.user.userId, req.body);
  tokenService.clearRefreshTokenCookie(res);
  res.clearCookie('accessToken');
  res.status(204).end();
}));

module.exports = router;
