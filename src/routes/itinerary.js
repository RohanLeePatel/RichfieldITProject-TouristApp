import * as itineraryRepo from '../repositories/itinerary.repository.js';
import * as tripRepo from '../repositories/trip.repository.js';

export const addItineraryItem = async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    if (isNaN(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID format.' });
    }

    const { title, description, location, startTime, endTime, dayNumber } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ error: 'Title and startTime are required.' });
    }

    const trip = await tripRepo.getTripById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    // Ensure requesting user owns or has access to the trip
    if (trip.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to modify this trip itinerary.' });
    }

    const item = await itineraryRepo.createItineraryItem({
      tripId,
      title,
      description,
      location,
      startTime,
      endTime,
      dayNumber,
    });

    return res.status(201).json({ message: 'Itinerary item added successfully.', item });
  } catch (error) {
    console.error('Error adding itinerary item:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const getTripItinerary = async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    if (isNaN(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID format.' });
    }

    const trip = await tripRepo.getTripById(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found.' });
    }

    if (trip.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to view this trip itinerary.' });
    }

    const items = await itineraryRepo.getItineraryByTripId(tripId);
    return res.status(200).json({ itinerary: items });
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

export const removeItineraryItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await itineraryRepo.getItineraryItemById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Itinerary item not found.' });
    }

    if (item.trip.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to delete this itinerary item.' });
    }

    await itineraryRepo.deleteItineraryItem(itemId);
    return res.status(200).json({ message: 'Itinerary item removed successfully.' });
  } catch (error) {
    console.error('Error deleting itinerary item:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};