const express = require('express');
const { getOverview } = require('../services/analyticsService');

const router = express.Router();

// GET /api/admin/analytics/overview - DAU, page views and session duration (7 and 30 days)
router.get('/overview', async (req, res) => {
  res.json(await getOverview());
});

module.exports = router;
