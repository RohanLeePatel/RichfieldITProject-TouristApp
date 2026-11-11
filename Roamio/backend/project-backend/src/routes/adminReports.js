const express = require('express');
const service = require('../services/destinationFeedbackService');

const router = express.Router();

// Place reports from travellers. Behind isAdmin (admin.js).

// GET /api/admin/reports - places with open reports, most-reported first; flagged = 3+ different travellers
router.get('/', async (req, res) => {
  res.json({ reports: await service.openReports(), flagAt: service.FLAG_AT });
});

// PATCH /api/admin/reports { placeKey, status: RESOLVED | DISMISSED } - closes every open report for that place.
// To also stop recommending a catalog city, hide it in /api/admin/destinations.
router.patch('/', async (req, res) => {
  res.json(await service.closeReports(req.body?.placeKey, req.body?.status));
});

module.exports = router;
