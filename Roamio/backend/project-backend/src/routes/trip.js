const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const requireAuth = require('../middleware/authMiddleware');

router.use(requireAuth);

// Create a trip within a group
router.post('/groups/:groupId/trips', tripController.createTrip);

// Get all trips for a specific group
router.get('/groups/:groupId/trips', tripController.getTripsByGroup);

// Get specific trip details
router.get('/trips/:tripId', tripController.getTripById);

module.exports = router;