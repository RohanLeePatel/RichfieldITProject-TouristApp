const express = require('express');
const { randomBytes, randomUUID } = require('node:crypto');
const router = express.Router();
const requireAuth = require('../middleware/authMiddleware');

const prisma = require('../config/prisma');
const validate = require('../middleware/validate');
const { createTripSchema, updateTripSchema, reorderItinerarySchema, createItinerarySchema } = require('../schemas/trips');
const { packMeta, unpackMeta, packItemMeta, itemStartDate, formatTime, formatItem, formatTrip, planReorder, accessibleTrips } = require('../utils/tripFormat');
const { assertTripAccess } = require('../services/tripAccessService');
const groupActivity = require('../services/groupActivityService');

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

const DAY_MS = 86_400_000;
const MAX_TRIP_DAYS = 30; // P-06: a trip lasts 1 to 30 days
const RESTORE_WINDOW_DAYS = 30; // a deleted trip can be brought back for this long

// Viewers read a trip but may not change it. Sends the 403 itself; true = go on.
async function canWrite(req, res, tripId, denied) {
  try {
    await assertTripAccess(tripId, req.user.userId, { write: true, denied });
    return true;
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
    return false;
  }
}

// Deleted trips the user could see, deleted within the restore window
const deletedTrips = (userId, extra = {}) => ({
  ...accessibleTrips(userId, extra),
  deletedAt: { gte: new Date(Date.now() - RESTORE_WINDOW_DAYS * DAY_MS) },
  travelGroup: { OR: [{ deletedAt: null }, { deletedWithTrips: true }] },
});

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

// GET /api/trips/deleted - Trips deleted in the last 30 days, which can be restored
router.get('/deleted', async (req, res) => {
  try {
    const trips = await prisma.trip.findMany({
      where: deletedTrips(req.user.userId),
      orderBy: { deletedAt: 'desc' },
    });
    res.json({ trips: trips.map((trip) => ({ ...formatTrip(trip), deletedAt: trip.deletedAt })) });
  } catch (error) {
    console.error('Error fetching deleted trips:', error);
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

    // the code lets anyone join as a MEMBER, so only group managers (or the organizer who
    // just created the group) may see it, matching travelGroupService
    const isManager = trip.members.length > 0 || (await prisma.travelGroupMember.findFirst({
      where: { travelGroupId: group.id, userId, role: { in: ['OWNER', 'ADMIN'] } },
    }));
    if (!isManager) return res.status(403).json({ message: 'Only group owners and admins can share the invite code.' });

    res.json({ inviteCode: group.inviteCode, travelGroupId: group.id, groupName: group.name });
  } catch (error) {
    console.error('Error sharing trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// PATCH /api/trips/:id - Edit a saved trip. Dates move together: items keep
// their day numbers, so every stop's calendar date moves with the trip (P-06).
router.patch('/:id', validate(updateTripSchema), async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });
    const body = req.body;

    const trip = await prisma.trip.findFirst({
      where: accessibleTrips(req.user.userId, { id: tripId }),
      include: { itineraries: true },
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    if (!(await canWrite(req, res, tripId, 'Viewers cannot change this trip.'))) return;

    const data = {};
    if (body.title !== undefined) data.title = body.title;

    // a field left out keeps its saved value
    const meta = unpackMeta(trip.description);
    for (const key of ['destination', 'budget', 'notes', 'currency', 'travellers', 'interests']) {
      if (body[key] !== undefined) meta[key] = body[key];
    }
    data.description = packMeta(meta);

    let moveItems = false;
    if (body.startDate !== undefined || body.endDate !== undefined) {
      const start = body.startDate ? new Date(body.startDate) : null;
      const end = body.endDate ? new Date(body.endDate) : null;
      if (!start !== !end) return res.status(400).json({ message: 'Give both dates or neither.' });
      if (start) {
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return res.status(400).json({ message: 'Those dates are not valid.' });
        const days = Math.round((end - start) / DAY_MS) + 1;
        if (days < 1 || days > MAX_TRIP_DAYS) return res.status(400).json({ message: `A trip lasts 1 to ${MAX_TRIP_DAYS} days.` });
        const outside = trip.itineraries.filter((item) => (item.dayNumber || 1) > days);
        if (outside.length) {
          return res.status(409).json({ message: 'Move or remove these stops first.', items: outside.map(formatItem) });
        }
      }
      data.startDate = start;
      data.endDate = end;
      moveItems = (trip.startDate?.getTime() ?? null) !== (start?.getTime() ?? null);
    }

    const [updated] = await prisma.$transaction([
      prisma.trip.update({ where: { id: tripId }, data }),
      ...(moveItems
        ? trip.itineraries.map((item) =>
            prisma.itineraryItem.update({
              where: { id: item.id },
              data: { startTime: itemStartDate(data.startDate, item.dayNumber, formatTime(item.startTime)) },
            })
          )
        : []),
    ]);

    await groupActivity.notifyTripChange({
      tripId,
      actorId: req.user.userId,
      what: moveItems ? 'changed the trip dates' : 'updated the trip details',
    });

    res.json({ message: 'Trip updated.', trip: formatTrip(updated) });
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// POST /api/trips/:id/restore - Bring back a trip deleted in the last 30 days
router.post('/:id/restore', async (req, res) => {
  try {
    const tripId = parseId(req.params.id);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID.' });
    const userId = req.user.userId;

    const trip = await prisma.trip.findFirst({
      where: deletedTrips(userId, { id: tripId }),
      include: {
        members: { where: { userId }, select: { role: true } },
        travelGroup: { include: { members: { where: { userId }, select: { role: true } } } },
      },
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found, or it was deleted more than 30 days ago.' });
    const role = trip.members[0]?.role || trip.travelGroup.members[0]?.role;
    if (role === 'VIEWER') return res.status(403).json({ message: 'Viewers cannot restore trips.' });

    const restored = await prisma.trip.update({ where: { id: tripId }, data: { deletedAt: null } });
    res.json({ message: 'Trip restored.', trip: formatTrip(restored) });
  } catch (error) {
    console.error('Error restoring trip:', error);
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
    if (!(await canWrite(req, res, tripId, 'Viewers cannot delete this trip.'))) return;

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
    if (!(await canWrite(req, res, tripId, 'Viewers cannot add stops to this trip.'))) return;

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

    await groupActivity.notifyTripChange({ tripId, actorId: req.user.userId, what: 'added a stop to the itinerary' });

    res.status(201).json({
      message: 'Itinerary item added successfully!',
      item: formatItem(newItem),
    });
  } catch (error) {
    console.error('Error adding itinerary item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// PUT /api/trips/:tripId/itinerary/order - Reorder stops and move them between days
router.put('/:tripId/itinerary/order', validate(reorderItinerarySchema), async (req, res) => {
  try {
    const tripId = parseId(req.params.tripId);
    if (tripId === null) return res.status(400).json({ message: 'Invalid trip ID parameter.' });

    const trip = await prisma.trip.findFirst({
      where: accessibleTrips(req.user.userId, { id: tripId }),
      include: { itineraries: true },
    });
    if (!trip) return res.status(404).json({ message: 'Trip not found or unauthorized.' });
    if (!(await canWrite(req, res, tripId, 'Viewers cannot reorder this trip.'))) return;

    const updates = planReorder(trip.itineraries, trip.startDate, req.body.days);
    if (!updates) return res.status(400).json({ message: 'Those stops do not belong to this trip.' });

    await prisma.$transaction(
      updates.map(({ id, dayNumber, startTime }) => prisma.itineraryItem.update({ where: { id }, data: { dayNumber, startTime } }))
    );
    res.json({ message: 'Itinerary reordered.' });
  } catch (error) {
    console.error('Error reordering itinerary:', error);
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

    if (!(await canWrite(req, res, tripId, 'Viewers cannot remove stops from this trip.'))) return;

    // scoped to this trip so one trip's id can't delete another trip's item
    const { count } = await prisma.itineraryItem.deleteMany({ where: { id: req.params.itemId, tripId } });
    if (count === 0) {
      return res.status(404).json({ message: 'Itinerary item not found.' });
    }

    await groupActivity.notifyTripChange({ tripId, actorId: req.user.userId, what: 'removed a stop from the itinerary' });

    res.json({ message: 'Itinerary item deleted successfully!' });
  } catch (error) {
    console.error('Error deleting itinerary item:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
