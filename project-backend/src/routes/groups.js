const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const authenticate = require('../middleware/authMiddleware');
const { requireGroupRole } = require('../middleware/rbacMiddleware');

// All group routes require authentication
router.use(authenticate);

// Group collection endpoints
router.post('/', groupController.createGroup);
router.get('/me', groupController.getMyGroups);
router.post('/join', groupController.joinByCode);
router.post('/invites/accept/:token', groupController.acceptInvite);

// Single group & RBAC protected routes
router.get('/:groupId', requireGroupRole('VIEWER'), groupController.getGroupById);
router.post('/:groupId/invites', requireGroupRole('ADMIN'), groupController.createInvite);
router.patch('/:groupId/members/:userId/role', requireGroupRole('OWNER'), groupController.updateRole);
router.delete('/:groupId/members/:userId', requireGroupRole('ADMIN'), groupController.removeMember);

module.exports = router;