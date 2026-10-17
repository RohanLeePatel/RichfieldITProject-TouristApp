const express = require('express');
const router = express.Router();
const travelGroupController = require('../controllers/travelGroupController');
const requireAuth = require('../middleware/authMiddleware');

// Auth is applied per route (not router.use) so this router, mounted at /api, doesn't
// intercept public endpoints that live in other routers (e.g. GET /api/invites/:token).
router.post('/groups', requireAuth, travelGroupController.createGroup);
router.get('/groups/me', requireAuth, travelGroupController.getMyGroups);
router.post('/groups/join', requireAuth, travelGroupController.joinGroup);

module.exports = router;
