const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const requireAuth = require('../middleware/authMiddleware');

router.use(requireAuth);

// Fetch the activity timeline for a specific trip
router.get('/trips/:tripId/activity', activityController.getTripActivityFeed);

module.exports = router;