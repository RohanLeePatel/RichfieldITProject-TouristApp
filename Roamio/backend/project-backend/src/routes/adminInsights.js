const express = require('express');
const { getInsights } = require('../services/adminInsightsService');

const router = express.Router();

// GET /api/admin/insights?days=7|30|90 - what people do in the app, from our own tables
router.get('/', async (req, res) => {
  res.json(await getInsights({ days: req.query.days }));
});

module.exports = router;
