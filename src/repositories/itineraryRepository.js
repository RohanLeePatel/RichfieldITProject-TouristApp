const prisma = require('../config/prisma');

const createItem = async (data) => {
  return await prisma.itineraryItem.create({ data });
};

const findItemsByTripId = async (tripId) => {
  return await prisma.itineraryItem.findMany({
    where: { tripId: parseInt(tripId, 10) },
    orderBy: { startTime: 'asc' }
  });
};

const findItemById = async (id) => {
  return await prisma.itineraryItem.findUnique({
    where: { id },
    include: {
      trip: {
        include: {
          members: true // Fetches members to verify access
        }
      }
    }
  });
};

const updateItem = async (id, data) => {
  return await prisma.itineraryItem.update({
    where: { id },
    data
  });
};

const deleteItem = async (id) => {
  return await prisma.itineraryItem.delete({
    where: { id }
  });
};

module.exports = {
  createItem,
  findItemsByTripId,
  findItemById,
  updateItem,
  deleteItem
};