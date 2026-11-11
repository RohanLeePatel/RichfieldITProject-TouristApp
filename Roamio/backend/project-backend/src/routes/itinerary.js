const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryController');
const requireAuth = require('../middleware/authMiddleware');

// Protect all itinerary endpoints
router.use(requireAuth);

router.get('/trips/:tripId/itinerary', itineraryController.getItinerary);

module.exports = router;