const express = require('express');
const router = express.Router();
const invitationController = require('../controllers/invitation.controller');
const requireAuth = require('../middleware/auth.middleware'); // Adjust path to your auth middleware

router.use(requireAuth);

// Create an invitation for a specific group
router.post('/groups/:groupId/invites', invitationController.createInvite);

// Accept an invitation using the token
router.post('/invites/accept', invitationController.acceptInvite);

module.exports = router;