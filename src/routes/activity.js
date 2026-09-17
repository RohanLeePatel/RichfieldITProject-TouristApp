const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activity.controller');
const requireAuth = require('../middleware/auth.middleware');

router.use(requireAuth);

// Fetch the activity timeline for a specific trip
router.get('/trips/:tripId/activity', activityController.getTripActivityFeed);

module.exports = router;