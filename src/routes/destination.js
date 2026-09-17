const express = require('express');
const router = express.Router();
const destController = require('../controllers/destination.controller');
const requireAuth = require('../middleware/auth.middleware');

router.use(requireAuth);

// --- GLOBAL LOOKUPS ---
// e.g. Used for frontend dropdowns when planning a trip
router.get('/countries', destController.getCountries);
router.get('/countries/:countryId/cities', destController.getCities);
router.get('/cities/:cityId/destinations', destController.getDestinations);

// --- TRIP DESTINATION MANAGEMENT ---
// Fetch and add destinations for a specific trip
router.get('/trips/:tripId/destinations', destController.getTripDestinations);
router.post('/trips/:tripId/destinations', destController.addTripDestination);

// Edit or remove a specific destination linked to a trip
router.put('/trip-destinations/:tripDestId', destController.updateTripDestination);
router.delete('/trip-destinations/:tripDestId', destController.removeTripDestination);

module.exports = router;