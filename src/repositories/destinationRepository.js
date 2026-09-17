const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const destinationRepository = {
  // --- GLOBAL GEOGRAPHY (Read-Only for Users) ---
  
  getCountries: async () => {
    return await prisma.country.findMany({
      orderBy: { name: 'asc' }
    });
  },

  getCitiesByCountry: async (countryId) => {
    return await prisma.city.findMany({
      where: { countryId: parseInt(countryId, 10) },
      orderBy: { name: 'asc' }
    });
  },

  getDestinationsByCity: async (cityId) => {
    return await prisma.destination.findMany({
      where: { cityId: parseInt(cityId, 10) },
      include: {
        tags: { include: { tag: true } }
      },
      orderBy: { name: 'asc' }
    });
  },

  // --- TRIP DESTINATIONS (Full CRUD) ---

  findTripDestinationById: async (id) => {
    return await prisma.tripDestination.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        trip: {
          include: { members: true }
        }
      }
    });
  },

  addTripDestination: async (tripId, destinationId, data) => {
    return await prisma.tripDestination.create({
      data: {
        tripId: parseInt(tripId, 10),
        destinationId: parseInt(destinationId, 10),
        orderIndex: data.orderIndex || 0,
        scheduledDay: data.scheduledDay || null,
        notes: data.notes || null
      },
      include: {
        destination: { include: { city: { include: { country: true } } } }
      }
    });
  },

  getTripDestinations: async (tripId) => {
    return await prisma.tripDestination.findMany({
      where: { tripId: parseInt(tripId, 10) },
      include: {
        destination: {
          include: {
            city: { include: { country: true } },
            tags: { include: { tag: true } }
          }
        }
      },
      orderBy: [
        { scheduledDay: 'asc' },
        { orderIndex: 'asc' }
      ]
    });
  },

  updateTripDestination: async (id, data) => {
    return await prisma.tripDestination.update({
      where: { id: parseInt(id, 10) },
      data: {
        orderIndex: data.orderIndex !== undefined ? data.orderIndex : undefined,
        scheduledDay: data.scheduledDay !== undefined ? data.scheduledDay : undefined,
        notes: data.notes !== undefined ? data.notes : undefined
      },
      include: {
        destination: true
      }
    });
  },

  removeTripDestination: async (id) => {
    return await prisma.tripDestination.delete({
      where: { id: parseInt(id, 10) }
    });
  }
};

module.exports = destinationRepository;