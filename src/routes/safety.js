const express = require('express');
const router = express.Router();
const safetyController = require('../controllers/safetyController');
const requireAuth = require('../middleware/authMiddleware');

// Apply authentication to all safety routes
router.use(requireAuth);

// Get safety data for a specific destination ID
router.get('/destinations/:destinationId/safety', safetyController.getDestinationSafety);

// Get safety data by country ISO code (e.g., /api/safety/ZAF)
router.get('/safety/:countryIso', safetyController.getCountrySafety);

module.exports = router;