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
            // role: 'ADMIN'
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
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      }
    });
  },

  // Get a single trip, ensuring the requesting user is a member
  getTripById: async (tripId, userId) => {
    return await prisma.trip.findFirst({
      where: { 
        id: parseInt(tripId, 10),
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
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        itineraryItems: true, // Updated to 'itineraryItems' to match your Prisma migration logs
        expenses: true
      }
    });
  }
};

module.exports = tripRepository;