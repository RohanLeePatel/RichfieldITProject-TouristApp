const tripRepository = require('../repositories/tripRepository');

exports.createTrip = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, description, startDate, endDate } = req.body;

    if (!title || !startDate || !endDate) {
      const error = new Error('Title, start date, and end date are required');
      error.statusCode = 400;
      throw error;
    }

    const newTrip = await tripRepository.createTrip(groupId, {
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    res.status(201).json({
      message: 'Trip created successfully',
      trip: newTrip,
    });
  } catch (error) {
    next(error);
  }
};

exports.getGroupTrips = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const trips = await tripRepository.getTripsByGroup(groupId);
    
    res.json({ trips });
  } catch (error) {
    next(error);
  }
};