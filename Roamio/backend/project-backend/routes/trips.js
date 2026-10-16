const express = require('express');
const { randomUUID } = require('node:crypto');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');

// Shared Prisma instance and Validation
const prisma = require('../db');
const validate = require('../middleware/validate');
const { createTripSchema, createItinerarySchema } = require('../schemas');
const { packMeta, unpackMeta, packItemMeta, itemStartDate, formatItem, formatTrip, accessibleTrips } = require('./tripFormat');

// Written against the LIVE Supabase schema (see prisma/schema.prisma): trips
// belong to a TravelGroup, users reach them through TripMember/TravelGroupMember,
// there is no destination/budget column (kept as JSON in Trip.description -
// see tripFormat.js), and deletes are soft (deletedAt).
// TODO(db): ItineraryItem has no cost column, so per-item cost is not stored;
// the budget endpoint sums the Expense table instead.

router.use(authenticateToken);

// Every trip needs a TravelGroup. Solo users get a personal one, created the
// first time they make a trip (existing accounts have none).
async function personalGroupId(userId) {
  const membership = await prisma.travelGroupMember.findFirst({ where: { userId }, orderBy: { id: 'asc' } });
  if (membership) return membership.travelGroupId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const group = await prisma.travelGroup.create({
    data: {
      name: `${user?.fullName || 'My'} trips`,
      members: { create: { userId, role: 'OWNER' } },
    },
  });
  return group.id;
}

const parseId = (value) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) ? null : id;
};

// ==========================================
// TRIP ENDPOINTS
// ==========================================

// POST /api/trips - Create a new trip (validated with Zod)
router.post('/', validate(createTripSchema), async (req, res) => {
  try {
    const { title, destination, startDate, endDate, budget, notes } = req.body;
    const userId = req.user.userId;

    const newTrip = await prisma.trip.create({
      data: {
        title,
        description: packMeta({ destination, budget, notes }),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        travelGroupId: await personalGroupId(userId),
        members: { create: { userId, role: 'OWNER' } },
      },
    });

    res.status(201).json({
      message: 'Trip created successfully!',
      trip: formatTrip(newTrip),
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
      where: accessibleTrips(req.user.userId),
      include: { _count: { select: { itinerary: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ trips: userTrips.map(formatTrip) });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/trips/:id - Fetch a single trip AND its itinerary items
router.get('/:id', async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });

    const trip = await prisma.trip.findFirst({
      where: accessibleTrips(req.user.userId, { id: tripId }),
      include: { itinerary: { orderBy: [{ dayNumber: 'asc' }, { startTime: 'asc' }] } },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }

    res.json({ trip: formatTrip(trip) });
  } catch (error) {
    console.error('Error fetching single trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// DELETE /api/trips/:id - Delete (soft) a trip
router.delete('/:id', async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });

    const trip = await prisma.trip.findFirst({ where: accessibleTrips(req.user.userId, { id: tripId }) });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    await prisma.trip.update({ where: { id: tripId }, data: { deletedAt: new Date() } });

    res.json({ message: 'Trip deleted successfully!' });
  } catch (error) {
    console.error('Error deleting trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/trips/:id/budget - Trip budget vs. logged expenses
router.get('/:id/budget', async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });

    const trip = await prisma.trip.findFirst({
      where: accessibleTrips(req.user.userId, { id: tripId }),
      include: { expenses: { select: { id: true, title: true, amount: true, category: true } } },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    const totalBudget = unpackMeta(trip.description).budget || 0;
    const totalExpenses = trip.expenses.reduce((sum, item) => sum + item.amount, 0);
    const remainingBudget = totalBudget - totalExpenses;

    let status = 'ON_TRACK';
    if (totalBudget > 0 && totalExpenses > totalBudget) {
      status = 'OVER_BUDGET';
    } else if (totalBudget > 0 && remainingBudget === 0) {
      status = 'MAXED_OUT';
    }

    res.json({
      tripId: trip.id,
      title: trip.title,
      summary: { totalBudget, totalExpenses, remainingBudget, status, itemCount: trip.expenses.length },
      expenseBreakdown: trip.expenses,
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
    const tripId = parseId(req.params.tripId);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID parameter.' });

    const { title, location, dayNumber, startTime, notes, lat, lon } = req.body;

    const trip = await prisma.trip.findFirst({ where: accessibleTrips(req.user.userId, { id: tripId }) });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    const newItem = await prisma.itineraryItem.create({
      data: {
        id: randomUUID(),
        tripId,
        title,
        location,
        description: packItemMeta({ notes, lat, lon }),
        dayNumber: dayNumber || 1,
        startTime: itemStartDate(trip.startDate, dayNumber, startTime),
      },
    });

    res.status(201).json({
      message: 'Itinerary item added successfully!',
      item: formatItem(newItem),
    });
  } catch (error) {
    console.error('Error adding itinerary item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// DELETE /api/trips/:tripId/itinerary/:itemId - Delete an itinerary item
router.delete('/:tripId/itinerary/:itemId', async (req, res) => {
  try {
    const tripId = parseId(req.params.tripId);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID parameter.' });

    const trip = await prisma.trip.findFirst({ where: accessibleTrips(req.user.userId, { id: tripId }) });
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    }

    // scoped to this trip so one trip's id can't delete another trip's item
    const { count } = await prisma.itineraryItem.deleteMany({ where: { id: req.params.itemId, tripId } });
    if (count === 0) {
      return res.status(404).json({ message: 'Itinerary item not found.' });
    }

    res.json({ message: 'Itinerary item deleted successfully!' });
  } catch (error) {
    console.error('Error deleting itinerary item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
