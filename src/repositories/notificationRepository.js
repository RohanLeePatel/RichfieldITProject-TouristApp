const prisma = require('../config/prisma');

const notificationRepository = {
  // 1. Internal use: Create a notification (e.g., triggered when an invite is sent)
  createNotification: async (data) => {
    return await prisma.notification.create({
      data: {
        userId: parseInt(data.userId, 10),
        title: data.title,
        message: data.message,
        type: data.type || 'INFO', // "INVITE", "TRIP_UPDATE", "ALERT", "INFO"
      }
    });
  },

  // 2. Fetch notifications for a user, sorted by newest
  getUserNotifications: async (userId, limit = 50) => {
    return await prisma.notification.findMany({
      where: { userId: parseInt(userId, 10) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  // 3. Get the count of unread notifications (great for badge icons on the frontend)
  getUnreadCount: async (userId) => {
    return await prisma.notification.count({
      where: { 
        userId: parseInt(userId, 10), 
        isRead: false 
      }
    });
  },

  // 4. Mark a specific notification as read
  markAsRead: async (notificationId, userId) => {
    // updateMany is used here instead of update to safely include the userId in the WHERE clause
    return await prisma.notification.updateMany({
      where: { 
        id: parseInt(notificationId, 10),
        userId: parseInt(userId, 10) 
      },
      data: { isRead: true }
    });
  },

  // 5. Mark all of a user's notifications as read
  markAllAsRead: async (userId) => {
    return await prisma.notification.updateMany({
      where: { 
        userId: parseInt(userId, 10),
        isRead: false
      },
      data: { isRead: true }
    });
  },

  // 6. Delete a notification
  deleteNotification: async (notificationId, userId) => {
    return await prisma.notification.deleteMany({
      where: { 
        id: parseInt(notificationId, 10),
        userId: parseInt(userId, 10) 
      }
    });
  }
};

module.exports = notificationRepository;