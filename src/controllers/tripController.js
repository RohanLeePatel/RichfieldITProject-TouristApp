const tripRepository = require('../repositories/tripRepository');

const tripController = {
  createTrip: async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const userId = req.user.id; // Assuming authMiddleware attaches the user
      const tripData = req.body;

      const newTrip = await tripRepository.createTrip(groupId, userId, tripData);
      return res.status(201).json({ message: 'Trip created successfully', trip: newTrip });
    } catch (error) {
      next(error);
    }
  },

  getTripsByGroup: async (req, res, next) => {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const trips = await tripRepository.getTripsByGroup(groupId, userId);
      return res.status(200).json({ trips });
    } catch (error) {
      next(error);
    }
  },

  getTripById: async (req, res, next) => {
    try {
      const { tripId } = req.params;
      const userId = req.user.id;

      const trip = await tripRepository.getTripById(tripId, userId);
      
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found or you do not have access.' });
      }

      return res.status(200).json({ trip });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = tripController;