const itineraryRepo = require('../repositories/itineraryRepository');
const prisma = require('../config/prisma');
const { accessibleTrips } = require('../utils/tripFormat');

// Read access matches GET /api/trips: a trip member, or a member of the trip's group.
// Note that updateItineraryItem and deleteItineraryItem check only TripMember rows, so
// a group-only member can read the itinerary but can't change a stop here. The
// newer trip API in routes/trips.js does not have this gap.
const verifyTripAccess = async (tripId, userId) => {
  return await prisma.trip.findFirst({
    where: accessibleTrips(parseInt(userId, 10), { id: parseInt(tripId, 10) }),
  });
};

const createItineraryItem = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;
    
    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied. You are not a member of this trip.' });

    const newItem = await itineraryRepo.createItem({ ...req.body, tripId: parseInt(tripId, 10) });
    return res.status(201).json({ item: newItem });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const getItinerary = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;
    
    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied.' });

    const items = await itineraryRepo.findItemsByTripId(tripId);
    return res.status(200).json({ items });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const updateItineraryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const existingItem = await itineraryRepo.findItemById(itemId);
    if (!existingItem) return res.status(404).json({ error: 'Item not found.' });

    const isMember = existingItem.trip.members.some(member => member.userId === userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied.' });

    const updated = await itineraryRepo.updateItem(itemId, req.body);
    return res.status(200).json({ item: updated });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

const deleteItineraryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    const existingItem = await itineraryRepo.findItemById(itemId);
    if (!existingItem) return res.status(404).json({ error: 'Item not found.' });

    const isMember = existingItem.trip.members.some(member => member.userId === userId);
    if (!isMember) return res.status(403).json({ error: 'Access denied.' });

    await itineraryRepo.deleteItem(itemId);
    return res.status(200).json({ message: 'Item deleted.' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { createItineraryItem, getItinerary, updateItineraryItem, deleteItineraryItem };