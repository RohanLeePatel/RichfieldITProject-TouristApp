const notificationRepo = require('../repositories/notificationRepository');

exports.getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

    const notifications = await notificationRepo.getUserNotifications(userId, limit);
    const unreadCount = await notificationRepo.getUnreadCount(userId);

    return res.status(200).json({ 
      notifications,
      unreadCount 
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const result = await notificationRepo.markAsRead(notificationId, userId);
    
    if (result.count === 0) {
      return res.status(404).json({ error: 'Notification not found or access denied.' });
    }

    return res.status(200).json({ message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await notificationRepo.markAllAsRead(userId);
    
    return res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const result = await notificationRepo.deleteNotification(notificationId, userId);

    if (result.count === 0) {
      return res.status(404).json({ error: 'Notification not found or access denied.' });
    }

    return res.status(200).json({ message: 'Notification deleted successfully.' });
  } catch (error) {
    next(error);
  }
};