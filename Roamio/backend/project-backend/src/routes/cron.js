const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const safetySyncService = require('../services/safetySyncService');

const router = express.Router();

// Called by Vercel Cron (see vercel.json), which sends "Authorization: Bearer
// $CRON_SECRET". Not behind a login: nobody else can know the secret. With no
// secret set the route is shut, so a missing variable never leaves it open.
const isCron = (req) => {
  const sent = Buffer.from(req.get('authorization') || '');
  const wanted = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  return sent.length === wanted.length && timingSafeEqual(sent, wanted);
};

// GET /api/cron/safety-alerts - refresh the advisories, then raise (and notify
// members of) alerts for trips whose destination is now level 3 or 4
router.get('/safety-alerts', async (req, res) => {
  if (!process.env.CRON_SECRET) return res.status(503).json({ message: 'Scheduled jobs are not configured.' });
  if (!isCron(req)) return res.status(401).json({ message: 'Not allowed.' });
  await safetySyncService.syncCountryAdvisories(); // logs its own failures
  res.json({ ok: true });
});

module.exports = router;
