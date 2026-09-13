import prisma from '../config/prisma.js';

export const createItineraryItem = async (data) => {
  return await prisma.itineraryItem.create({
    data: {
      tripId: Number(data.tripId),
      title: data.title,
      description: data.description,
      location: data.location,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : null,
      dayNumber: data.dayNumber ? Number(data.dayNumber) : 1,
    },
  });
};

export const getItineraryByTripId = async (tripId) => {
  return await prisma.itineraryItem.findMany({
    where: { tripId: Number(tripId) },
    orderBy: { startTime: 'asc' },
  });
};

export const getItineraryItemById = async (id) => {
  return await prisma.itineraryItem.findUnique({
    where: { id },
    include: { trip: true },
  });
};

export const updateItineraryItem = async (id, data) => {
  return await prisma.itineraryItem.update({
    where: { id },
    data: {
      ...data,
      startTime: data.startTime ? new Date(data.startTime) : undefined,
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      dayNumber: data.dayNumber ? Number(data.dayNumber) : undefined,
    },
  });
};

export const deleteItineraryItem = async (id) => {
  return await prisma.itineraryItem.delete({
    where: { id },
  });
};