const express = require('express');
const { randomBytes, randomUUID } = require('node:crypto');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');

const prisma = require('../config/prisma');
const validate = require('../middleware/validate');
const { createTripSchema, createItinerarySchema } = require('../schemas/trips');
const { packMeta, packItemMeta, itemStartDate, formatItem, formatTrip, accessibleTrips } = require('../utils/tripFormat');

// The frontend's trip API: personal and group trips in one list. Every trip
// belongs to a TravelGroup; a solo user's trips live in a personal group (see
// personalGroupId). Trip has no destination/budget columns, so those are kept
// as JSON in Trip.description (see utils/tripFormat.js). Deletes are soft.
//
// Mounted at /api/trips ahead of the group routes in trip.js/itinerary.js, so
// GET /api/trips/:id and POST /api/trips/:id/itinerary are answered here (with
// a superset of what those returned). Paths not matched here fall through to
// them, e.g. GET /api/trips/:id/itinerary and the budget/expense routes.
// TODO(db): ItineraryItem has no cost column, so per-item cost is not stored.

router.use(requireAuth);

// Every trip needs a TravelGroup. Solo users get a personal one, created the
// first time they make a trip. Personal groups have no invite code, while
// groups made through /api/groups always get one, so a personal trip never
// lands in a group shared with other people.
async function personalGroupId(userId) {
  const membership = await prisma.travelGroupMember.findFirst({
    where: { userId, role: 'OWNER', travelGroup: { inviteCode: null, deletedAt: null } },
    orderBy: { id: 'asc' },
  });
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

// The group a new trip goes in: the given shared group if the user can create
// trips there (any role but VIEWER), else their personal group. null = refused.
async function tripGroupId(userId, travelGroupId) {
  if (!travelGroupId) return personalGroupId(userId);
  const membership = await prisma.travelGroupMember.findFirst({
    where: { userId, travelGroupId, role: { not: 'VIEWER' }, travelGroup: { deletedAt: null } },
  });
  return membership ? travelGroupId : null;
}

// POST /api/trips - Create a trip: personal, or in a shared group via travelGroupId
router.post('/', validate(createTripSchema), async (req, res) => {
  try {
    const { title, destination, startDate, endDate, budget, notes, currency, travellers, interests } = req.body;
    const userId = req.user.userId;
    const groupId = await tripGroupId(userId, req.body.travelGroupId);
    if (groupId === null) return res.status(404).json({ message: 'Travel group not found.' });

    const newTrip = await prisma.trip.create({
      data: {
        title,
        description: packMeta({ destination, budget, notes, currency, travellers, interests }),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        travelGroupId: groupId,
        members: { create: { userId, role: 'ORGANIZER' } },
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

// GET /api/trips - Every trip the user can reach: personal and group
router.get('/', async (req, res) => {
  try {
    const userTrips = await prisma.trip.findMany({
      where: accessibleTrips(req.user.userId),
      include: { _count: { select: { itineraries: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ trips: userTrips.map(formatTrip) });
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// GET /api/trips/:id - One trip with its itinerary, members and destinations
router.get('/:id', async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });

    const trip = await prisma.trip.findFirst({
      where: accessibleTrips(req.user.userId, { id: tripId }),
      include: {
        itineraries: { orderBy: [{ dayNumber: 'asc' }, { startTime: 'asc' }] },
        members: { include: { user: { select: { id: true, fullName: true, email: true } } } },
        destinations: { include: { destination: { include: { city: { include: { country: true } } } } } },
      },
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

// POST /api/trips/:id/share - the join code for the trip's group, for an
// invite link. A personal trip first moves into a new group of its own:
// sharing the personal group would show the guest every solo trip. Only the
// organizer can do that move; anyone on a group trip can share its code.
router.post('/:id/share', async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({
      where: accessibleTrips(userId, { id: tripId }),
      include: { travelGroup: true, members: { where: { userId, role: 'ORGANIZER' } } },
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });

    let group = trip.travelGroup;
    if (!group.inviteCode) {
      if (trip.members.length === 0) {
        return res.status(403).json({ message: 'Only the trip organizer can invite people to this trip.' });
      }
      // one statement: the trip never ends up pointing at a half-made group
      ({ travelGroup: group } = await prisma.trip.update({
        where: { id: tripId },
        data: {
          travelGroup: {
            create: {
              name: `${trip.title} group`.slice(0, 100),
              inviteCode: randomBytes(4).toString('hex').toUpperCase(),
              members: { create: { userId, role: 'OWNER' } },
            },
          },
        },
        include: { travelGroup: true },
      }));
    }

    res.json({ inviteCode: group.inviteCode, travelGroupId: group.id, groupName: group.name });
  } catch (error) {
    console.error('Error sharing trip:', error);
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
