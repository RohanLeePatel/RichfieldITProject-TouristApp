const activityRepo = require('../repositories/activity.repository');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to verify group/trip access
const verifyTripAccess = async (tripId, userId) => {
  return await prisma.trip.findFirst({
    where: {
      id: parseInt(tripId, 10),
      members: { some: { userId: parseInt(userId, 10) } },
    },
  });
};

exports.getTripActivityFeed = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    // Security check
    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const logs = await activityRepo.getLogsByTripId(tripId);
    return res.status(200).json({ activityFeed: logs });
  } catch (error) {
    next(error);
  }
};