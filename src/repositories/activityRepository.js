const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const activityRepository = {
  // Create a new audit log entry
  createLog: async (data) => {
    return await prisma.activityLog.create({
      data: {
        userId: parseInt(data.userId, 10),
        tripId: data.tripId ? parseInt(data.tripId, 10) : null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ? parseInt(data.entityId, 10) : null,
        details: data.details || null,
      },
    });
  },

  // Fetch the activity timeline for a specific trip (e.g., for a "Recent Activity" feed)
  getLogsByTripId: async (tripId, limit = 50) => {
    return await prisma.activityLog.findMany({
      where: { tripId: parseInt(tripId, 10) },
      include: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  // Fetch the activity timeline for an entire travel group
  getLogsByGroupId: async (groupId, limit = 50) => {
    return await prisma.activityLog.findMany({
      where: {
        trip: {
          travelGroupId: parseInt(groupId, 10),
        },
      },
      include: {
        user: { select: { id: true, fullName: true, avatarUrl: true } },
        trip: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};

module.exports = activityRepository;