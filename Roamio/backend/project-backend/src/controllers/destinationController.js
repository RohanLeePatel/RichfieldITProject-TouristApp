const destinationRepo = require('../repositories/destinationRepository');
const prisma = require('../config/prisma');
const { accessibleTrips } = require('../utils/tripFormat');
const { assertTripAccess } = require('../services/tripAccessService');

// Read access matches GET /api/trips: a trip member, or a member of the trip's group.
// The edit and remove handlers below check only TripMember rows, so they are stricter
// than this helper (see the note in itineraryController.js).
const verifyTripAccess = async (tripId, userId) => {
  return await prisma.trip.findFirst({
    where: accessibleTrips(parseInt(userId, 10), { id: parseInt(tripId, 10) }),
  });
};

// --- GLOBAL GEOGRAPHY HANDLERS ---

exports.getCountries = async (req, res, next) => {
  try {
    const countries = await destinationRepo.getCountries();
    return res.status(200).json({ countries });
  } catch (error) {
    next(error);
  }
};

exports.getCities = async (req, res, next) => {
  try {
    const { countryId } = req.params;
    const cities = await destinationRepo.getCitiesByCountry(countryId);
    return res.status(200).json({ cities });
  } catch (error) {
    next(error);
  }
};

exports.getDestinations = async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const destinations = await destinationRepo.getDestinationsByCity(cityId);
    return res.status(200).json({ destinations });
  } catch (error) {
    next(error);
  }
};

// --- TRIP DESTINATION HANDLERS ---

exports.getTripDestinations = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied.' });

    const tripDestinations = await destinationRepo.getTripDestinations(tripId);
    return res.status(200).json({ tripDestinations });
  } catch (error) {
    next(error);
  }
};

exports.addTripDestination = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const { destinationId, orderIndex, scheduledDay, notes } = req.body;
    const userId = req.user.id;

    if (!destinationId) {
      return res.status(400).json({ error: 'destinationId is required.' });
    }

    const trip = await verifyTripAccess(tripId, userId);
    if (!trip) return res.status(403).json({ error: 'Access denied.' });
    await assertTripAccess(trip.id, userId, { write: true, denied: 'Viewers cannot change trip destinations' });

    const addedDestination = await destinationRepo.addTripDestination(tripId, destinationId, {
      orderIndex,
      scheduledDay,
      notes
    });

    return res.status(201).json({
      message: 'Destination added to trip.',
      tripDestination: addedDestination
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTripDestination = async (req, res, next) => {
  try {
    const { tripDestId } = req.params;
    const userId = req.user.id;

    const existingTarget = await destinationRepo.findTripDestinationById(tripDestId);
    if (!existingTarget) return res.status(404).json({ error: 'Trip destination not found.' });

    await assertTripAccess(existingTarget.tripId, userId, { write: true, denied: 'Viewers cannot change trip destinations' });

    const updated = await destinationRepo.updateTripDestination(tripDestId, {
      orderIndex: req.body.orderIndex,
      scheduledDay: req.body.scheduledDay,
      notes: req.body.notes,
    });
    return res.status(200).json({
      message: 'Trip destination updated.',
      tripDestination: updated
    });
  } catch (error) {
    next(error);
  }
};

exports.removeTripDestination = async (req, res, next) => {
  try {
    const { tripDestId } = req.params;
    const userId = req.user.id;

    const existingTarget = await destinationRepo.findTripDestinationById(tripDestId);
    if (!existingTarget) return res.status(404).json({ error: 'Trip destination not found.' });

    await assertTripAccess(existingTarget.tripId, userId, { write: true, denied: 'Viewers cannot change trip destinations' });

    await destinationRepo.removeTripDestination(tripDestId);
    return res.status(200).json({ message: 'Destination removed from trip.' });
  } catch (error) {
    next(error);
  }
};