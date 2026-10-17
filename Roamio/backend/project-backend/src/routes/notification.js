const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const requireAuth = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(requireAuth);

// Fetch inbox and unread count
router.get('/', notificationController.getMyNotifications);

// Mark everything as read
router.patch('/read-all', notificationController.markAllAsRead);

// Manage a specific notification
router.patch('/:notificationId/read', notificationController.markAsRead);
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;