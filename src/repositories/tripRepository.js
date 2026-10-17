const prisma = require('../prismaClient');

const tripRepository = {
  // Create a new trip linked to a group AND assign the creator as a TripMember
  createTrip: async (groupId, userId, tripData) => {
    return await prisma.trip.create({
      data: {
        ...tripData,
        travelGroupId: parseInt(groupId, 10),
        members: {
          create: {
            userId: userId,
            role: 'ORGANIZER'
          }
        }
      },
      include: {
        members: true 
      }
    });
  },

  // Get all trips for a specific group, ensuring the requesting user is a member
  getTripsByGroup: async (groupId, userId) => {
    return await prisma.trip.findMany({
      where: { 
        travelGroupId: parseInt(groupId, 10),
        deletedAt: null,
        members: {
          some: { userId: userId }
        }
      },
      orderBy: { startDate: 'asc' },
      include: {
        destinations: {
          include: { destination: true } 
        },
        members: {
          include: { user: { select: { id: true, fullName: true, email: true } } }
        }
      }
    });
  },

  // Get a single trip, ensuring the requesting user is a member
  getTripById: async (tripId, userId) => {
    return await prisma.trip.findFirst({
      where: { 
        id: parseInt(tripId, 10),
        deletedAt: null,
        members: {
          some: { userId: userId }
        }
      },
      include: {
        destinations: {
          include: {
            destination: {
              include: { city: { include: { country: true } } } // Deep fetch for safety feature integration
            }
          }
        },
        members: {
          include: { user: { select: { id: true, fullName: true, email: true } } }
        },
        itineraries: true,
        expenses: true
      }
    });
  },

  // Membership row for access checks; null if the user isn't on an active trip
  findActiveMembership: async (tripId, userId) => {
    return await prisma.tripMember.findFirst({
      where: { tripId, userId, trip: { deletedAt: null } }
    });
  },

  findMemberUserIds: async (tripId) => {
    const members = await prisma.tripMember.findMany({
      where: { tripId },
      select: { userId: true },
      orderBy: { userId: 'asc' }
    });
    return members.map((m) => m.userId);
  }
};

module.exports = tripRepository;