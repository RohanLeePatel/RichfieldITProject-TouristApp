const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const requireAuth = require('../middleware/auth.middleware');

// All notification routes require authentication
router.use(requireAuth);

// Fetch inbox and unread count
router.get('/notifications', notificationController.getMyNotifications);

// Mark everything as read
router.patch('/notifications/read-all', notificationController.markAllAsRead);

// Manage a specific notification
router.patch('/notifications/:notificationId/read', notificationController.markAsRead);
router.delete('/notifications/:notificationId', notificationController.deleteNotification);

module.exports = router;