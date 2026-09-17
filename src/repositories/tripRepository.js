const prisma = require('../prismaClient');

const tripRepository = {
  // Create a new trip linked to a group AND assign the creator as a TripMember
  createTrip: async (groupId, userId, tripData) => {
    return await prisma.trip.create({
      data: {
        ...tripData,
        travelGroupId: parseInt(groupId, 10), // Updated to match schema
        
        // Automatically create the relational TripMember record for the creator
        members: {
          create: {
            userId: userId,
            // If your TripMember schema requires a role, you can add it here:
            // role: 'ADMIN' 
          }
        }
      },
      include: {
        members: true // Return the newly created member data alongside the trip
      }
    });
  },

  // Get all trips for a specific group, ensuring the requesting user is a member
  getTripsByGroup: async (groupId, userId) => {
    return await prisma.trip.findMany({
      where: { 
        travelGroupId: parseInt(groupId, 10), // Updated to match schema
        members: {
          some: { 
            userId: userId // Security check: Only fetch if user is a member of the trip
          }
        }
      },
      orderBy: { startDate: 'asc' },
      include: {
        members: true // Optional: Include members in the response if the frontend needs it
      }
    });
  },

  // Get a single trip, ensuring the requesting user is a member
  getTripById: async (tripId, userId) => {
    return await prisma.trip.findFirst({
      where: { 
        id: parseInt(tripId, 10),
        members: {
          some: {
            userId: userId // Security check
          }
        }
      },
      include: {
        members: true,
        itineraries: true, 
        expenses: true
      }
    });
  }
};

module.exports = tripRepository;