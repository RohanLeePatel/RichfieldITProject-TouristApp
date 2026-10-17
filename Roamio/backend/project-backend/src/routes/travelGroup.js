const express = require('express');
const router = express.Router();
const travelGroupController = require('../controllers/travelGroupController');
const requireAuth = require('../middleware/authMiddleware');

// Auth is applied per route (not router.use) so this router, mounted at /api, doesn't
// intercept public endpoints that live in other routers (e.g. GET /api/invites/:token).
router.post('/groups', requireAuth, travelGroupController.createGroup);
router.get('/groups/me', requireAuth, travelGroupController.getMyGroups);
router.post('/groups/join', requireAuth, travelGroupController.joinGroup);

// Group details & member management (declared after /groups/me and /groups/join)
router.get('/groups/:groupId', requireAuth, travelGroupController.getGroupDetails);
router.patch('/groups/:groupId/members/:memberId', requireAuth, travelGroupController.updateMemberRole);
router.delete('/groups/:groupId/members/:memberId', requireAuth, travelGroupController.removeMember);

module.exports = router;
