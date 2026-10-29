const express = require('express');

const router = express.Router();

// GET /api/admin/config/tracking - public identifiers the dashboard needs to
// load the GA and Clarity UI. Lists each value by name, so a secret added to
// the environment later can't leak through here.
router.get('/tracking', (req, res) => {
  res.json({
    clarityProjectId: process.env.CLARITY_PROJECT_ID || null,
    gaMeasurementId: process.env.GA_MEASUREMENT_ID || null,
  });
});

module.exports = router;
