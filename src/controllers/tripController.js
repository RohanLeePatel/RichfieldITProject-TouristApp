const tripRepository = require('../repositories/tripRepository');
const tripService = require('../services/tripService');
const { parseId } = require('../services/tripAccessService');

const tripController = {
  createTrip: async (req, res, next) => {
    try {
      const groupId = parseId(req.params.groupId, 'groupId');
      const newTrip = await tripService.createTrip(groupId, req.user.id, req.body);
      return res.status(201).json({ message: 'Trip created successfully', trip: newTrip });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  },

  getTripsByGroup: async (req, res, next) => {
    try {
      const groupId = parseId(req.params.groupId, 'groupId');
      const userId = req.user.id;

      const trips = await tripRepository.getTripsByGroup(groupId, userId);
      return res.status(200).json({ trips });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  },

  getTripById: async (req, res, next) => {
    try {
      const tripId = parseId(req.params.tripId, 'tripId');
      const userId = req.user.id;

      const trip = await tripRepository.getTripById(tripId, userId);
      
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found or you do not have access.' });
      }

      return res.status(200).json({ trip });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      next(error);
    }
  }
};

module.exports = tripController;