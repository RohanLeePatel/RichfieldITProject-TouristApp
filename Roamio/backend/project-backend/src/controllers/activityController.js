const activityRepo = require('../repositories/activityRepository');
const prisma = require('../config/prisma');
const { accessibleTrips } = require('../utils/tripFormat');

// Same reach as GET /api/trips: a trip member, or a member of the trip's group
const verifyTripAccess = async (tripId, userId) => {
  return await prisma.trip.findFirst({
    where: accessibleTrips(parseInt(userId, 10), { id: parseInt(tripId, 10) }),
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