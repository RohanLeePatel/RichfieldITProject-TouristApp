const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');

// Shared Prisma instance and Validation
const prisma = require('../db');
const validate = require('../middleware/validate');
const { createTripSchema, createItinerarySchema } = require('../schemas');

// Protect all routes in this file with JWT middleware
router.use(authenticateToken);

// ==========================================
// TRIP ENDPOINTS
// ==========================================

// POST /api/trips - Create a new trip (validated with Zod)
router.post('/', validate(createTripSchema), async (req, res) => {
  try {
    const { title, destination, startDate, endDate, budget, notes } = req.body;

    const newTrip = await prisma.trip.create({
      data: {
        title,
        destination,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget,
        notes,
        userId: req.user.userId,
      },
    });

    res.status(201).json({
      message: 'Trip created successfully!',
      trip: newTrip,
    });
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/trips - Fetch all trips for the logged-in user
router.get('/', async (req, res) => {
  try {
    const userTrips = await prisma.trip.findMany({
      where: { userId: req.user.userId },
      include: {
        _count: {
          select: { itinerary: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ trips: userTrips });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/trips/:id - Fetch a single trip AND its itinerary items
router.get('/:id', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user.userId,
      },
      include: {
        itinerary: {
          orderBy: [{ dayNumber: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    res.json({ trip });
  } catch (error) {
    console.error('Error fetching single trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// DELETE /api/trips/:id - Delete a trip
router.delete('/:id', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user.userId,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    await prisma.trip.delete({
      where: { id: tripId },
    });

    res.json({ message: 'Trip deleted successfully!' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/trips/:id/budget - Calculate trip budget, total expenses, and remaining funds
router.get('/:id/budget', async (req, res) => {
  try {
    const tripId = parseInt(req.params.id);

    if (isNaN(tripId)) {
      return res.status(400).json({ message: 'Invalid trip ID.' });
    }

    // Fetch the trip and its associated itinerary item costs
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user.userId,
      },
      select: {
        id: true,
        title: true,
        budget: true,
        itinerary: {
          select: {
            id: true,
            title: true,
            cost: true,
          },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    // Aggregate costs
    const totalBudget = trip.budget || 0;
    const totalExpenses = trip.itinerary.reduce((sum, item) => sum + (item.cost || 0), 0);
    const remainingBudget = totalBudget - totalExpenses;

    // Determine status
    let status = 'ON_TRACK';
    if (totalBudget > 0 && totalExpenses > totalBudget) {
      status = 'OVER_BUDGET';
    } else if (totalBudget > 0 && remainingBudget === 0) {
      status = 'MAXED_OUT';
    }

    res.json({
      tripId: trip.id,
      title: trip.title,
      summary: {
        totalBudget,
        totalExpenses,
        remainingBudget,
        status,
        itemCount: trip.itinerary.length,
      },
      expenseBreakdown: trip.itinerary,
    });
  } catch (error) {
    console.error('Error calculating budget:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// ==========================================
// ITINERARY ENDPOINTS
// ==========================================

// POST /api/trips/:tripId/itinerary - Add an itinerary item (validated with Zod)
router.post('/:tripId/itinerary', validate(createItinerarySchema), async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const { title, location, dayNumber, startTime, cost, notes } = req.body;

    if (isNaN(tripId)) {
      return res.status(400).json({ message: 'Invalid trip ID parameter.' });
    }

    // Verify trip exists and belongs to the logged-in user
    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user.userId,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    const newItem = await prisma.itineraryItem.create({
      data: {
        title,
        location,
        dayNumber,
        startTime,
        cost,
        notes,
        tripId,
      },
    });

    res.status(201).json({
      message: 'Itinerary item added successfully!',
      item: newItem,
    });
  } catch (error) {
    console.error('Error adding itinerary item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// DELETE /api/trips/:tripId/itinerary/:itemId - Delete an itinerary item
router.delete('/:tripId/itinerary/:itemId', async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const itemId = parseInt(req.params.itemId);

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        userId: req.user.userId,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    await prisma.itineraryItem.delete({
      where: { id: itemId },
    });

    res.json({ message: 'Itinerary item deleted successfully!' });
  } catch (error) {
    console.error('Error deleting itinerary item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;