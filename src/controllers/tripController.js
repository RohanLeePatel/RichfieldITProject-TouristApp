const tripRepository = require('../repositories/tripRepository'); // Note: previously this was trip.repository.js, matching your import exactly

exports.createTrip = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, description, startDate, endDate } = req.body;
    
    // 1. Capture the authenticated user's ID
    const userId = req.user.id; 

    if (!title || !startDate || !endDate) {
      const error = new Error('Title, start date, and end date are required');
      error.statusCode = 400;
      throw error;
    }

    // 2. Pass userId to the repository to verify group access AND create the TripMember record
    const newTrip = await tripRepository.createTrip(groupId, userId, {
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
    next(error); // Forwards to your global Express error handler
  }
};

exports.getGroupTrips = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    // 1. Capture the authenticated user's ID
    const userId = req.user.id; 

    // 2. Pass userId to ensure they only fetch trips if they are actually authorized for this group
    const trips = await tripRepository.getTripsByGroup(groupId, userId);
    
    res.json({ trips });
  } catch (error) {
    next(error);
  }
};
