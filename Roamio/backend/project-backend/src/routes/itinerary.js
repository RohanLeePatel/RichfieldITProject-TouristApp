const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itineraryController');
const requireAuth = require('../middleware/authMiddleware');

// Protect all itinerary endpoints
router.use(requireAuth);

router.post('/trips/:tripId/itinerary', itineraryController.createItineraryItem);
router.get('/trips/:tripId/itinerary', itineraryController.getItinerary);
router.put('/itinerary/:itemId', itineraryController.updateItineraryItem);
router.delete('/itinerary/:itemId', itineraryController.deleteItineraryItem);

module.exports = router;