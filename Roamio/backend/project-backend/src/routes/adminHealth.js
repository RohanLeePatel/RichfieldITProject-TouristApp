const express = require('express');
const { checkAll } = require('../services/healthService');

const router = express.Router();

// GET /api/admin/health/services - status (online/degraded/down) and latency per service
router.get('/services', async (req, res) => {
  const services = await checkAll();
  res.json({ checkedAt: new Date().toISOString(), services });
});

module.exports = router;
