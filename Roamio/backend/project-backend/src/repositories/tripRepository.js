const { unpackMeta } = require('../utils/tripFormat');
const prisma = require('../config/prisma');

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

  // A group member reaches the group's trips without a TripMember row (the
  // rule GET /api/trips uses - utils/tripFormat.accessibleTrips). Their group
  // role stands in; null if they're not in the trip's group either.
  findGroupMembershipForTrip: async (tripId, userId) => {
    return await prisma.travelGroupMember.findFirst({
      where: { userId, travelGroup: { deletedAt: null, trips: { some: { id: tripId, deletedAt: null } } } },
      select: { role: true }
    });
  },

  // Everyone who can share this trip's costs: its TripMembers plus the members
  // of its travel group (the same people assertTripAccess lets in).
  findMemberUserIds: async (tripId) => {
    const [members, groupMembers] = await Promise.all([
      prisma.tripMember.findMany({ where: { tripId }, select: { userId: true } }),
      prisma.travelGroupMember.findMany({
        where: { travelGroup: { deletedAt: null, trips: { some: { id: tripId } } } },
        select: { userId: true }
      })
    ]);
    return [...new Set([...members, ...groupMembers].map((m) => m.userId))].sort((a, b) => a - b);
  },

  // Title + the currency the wizard saved on the trip (Trip.description JSON)
  findTripMeta: async (tripId) => {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { title: true, description: true } });
    return { title: trip?.title || null, currency: unpackMeta(trip?.description).currency || null };
  },

  // The trip's saved split of new expenses, { userId: percent }, or null for an even split
  findSplitShares: async (tripId) => {
    const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { splitShares: true } });
    const shares = trip?.splitShares;
    return shares && Object.keys(shares).length ? shares : null;
  },

  // {} clears it (back to an even split)
  setSplitShares: async (tripId, shares) => {
    await prisma.trip.update({ where: { id: tripId }, data: { splitShares: shares } });
  }
};

module.exports = tripRepository;