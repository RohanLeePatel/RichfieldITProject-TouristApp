const express = require('express');
const reports = require('../services/adminReportsService');
const feedback = require('../services/destinationFeedbackService');
const safetySync = require('../services/safetySyncService');
const { log } = require('../services/adminAuditService');

const router = express.Router();

// GET /api/admin/reports - places travellers reported, most-reported first (the Reports queue)
router.get('/', async (req, res) => res.json({ flagAt: feedback.FLAG_AT, reports: await feedback.openReports() }));

// PATCH /api/admin/reports { placeKey, status: RESOLVED|DISMISSED } - closes a place's open reports
router.patch('/', async (req, res) => {
  const result = await feedback.closeReports(req.body?.placeKey, req.body?.status);
  await log(req.user.id, 'ADMIN_PLACE_REPORTS_CLOSE', { entityType: 'PLACE', details: `${req.body.placeKey} ${req.body.status}` });
  res.json(result);
});

// GET /api/admin/reports/audience?days=7|30|90 - devices, browsers, systems, languages, currencies
router.get('/audience', async (req, res) => res.json(await reports.audience({ days: req.query.days })));

// GET /api/admin/reports/engagement?days= - push devices, alert opt-ins, notifications sent and read
router.get('/engagement', async (req, res) => res.json(await reports.engagement({ days: req.query.days })));

// GET /api/admin/reports/spending?days= - expenses per currency and category, budgets, settled splits
router.get('/spending', async (req, res) => res.json(await reports.spending({ days: req.query.days })));

// GET /api/admin/reports/safety - advisories, stale or missing ones, trips heading to high-risk countries
router.get('/safety', async (req, res) => res.json(await reports.safety()));

// POST /api/admin/reports/safety/sync - re-checks every advisory now. It takes a while and
// the provider has a quota, so it runs in the background and answers 202 at once.
// ponytail: the "already running" flag lives in this process only; a second server instance could overlap.
let syncing = false;
router.post('/safety/sync', async (req, res) => {
  if (syncing) return res.status(409).json({ success: false, status: 409, message: 'A safety check is already running.' });
  syncing = true;
  safetySync.syncCountryAdvisories().finally(() => {
    syncing = false;
  });
  await log(req.user.id, 'ADMIN_SAFETY_SYNC', { entityType: 'SAFETY', details: 'advisories re-checked' });
  res.status(202).json({ started: true });
});

module.exports = router;
