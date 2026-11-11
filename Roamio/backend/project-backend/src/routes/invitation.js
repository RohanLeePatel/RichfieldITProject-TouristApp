const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitationController');
const requireAuth = require('../middleware/authMiddleware');

// Public preview: lets an invitee see what they're joining before signing in; does not consume the token
router.get('/invites/:token', requireAuth.optionalAuth, invitationController.previewInvite);

// Everything below requires authentication
router.use(requireAuth);

// Create an invitation for a specific group (OWNER/ADMIN only)
router.post('/groups/:groupId/invites', invitationController.createInvite);

// Accept an invitation using the token
router.post('/invites/accept', invitationController.acceptInvite);

module.exports = router;
