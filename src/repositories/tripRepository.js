const prisma = require('../prismaClient');

const tripRepository = {
  // Create a new trip linked to a group
  createTrip: async (groupId, tripData) => {
    return await prisma.trip.create({
      data: {
        ...tripData,
        groupId: parseInt(groupId),
      },
    });
  },

  // Get all trips for a specific group
  getTripsByGroup: async (groupId) => {
    return await prisma.trip.findMany({
      where: { groupId: parseInt(groupId) },
      orderBy: { startDate: 'asc' },
    });
  },

  // Get a single trip with its basic details
  getTripById: async (tripId) => {
    return await prisma.trip.findUnique({
      where: { id: parseInt(tripId) },
    });
  }
};

module.exports = tripRepository;