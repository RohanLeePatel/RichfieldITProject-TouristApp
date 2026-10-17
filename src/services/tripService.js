const tripRepository = require('../repositories/tripRepository');
const travelGroupRepository = require('../repositories/travelGroupRepository');
const { httpError } = require('./tripAccessService');

const TRIP_STATUSES = ['PLANNING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED'];

const parseOptionalDate = (value, label) => {
  if (value === undefined || value === null) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${label} must be a valid date`);
  return date;
};

// Only whitelisted fields reach the database (no client-supplied id, deletedAt, members, etc.)
const buildTripData = (body) => {
  if (typeof body.title !== 'string' || !body.title.trim()) throw httpError(400, 'title is required');

  const startDate = parseOptionalDate(body.startDate, 'startDate');
  const endDate = parseOptionalDate(body.endDate, 'endDate');
  if (startDate && endDate && endDate < startDate) throw httpError(400, 'endDate cannot be before startDate');

  const data = { title: body.title.trim() };
  if (typeof body.description === 'string') data.description = body.description.trim();
  if (startDate) data.startDate = startDate;
  if (endDate) data.endDate = endDate;
  if (body.status !== undefined) {
    const status = typeof body.status === 'string' ? body.status.toUpperCase() : body.status;
    if (!TRIP_STATUSES.includes(status)) throw httpError(400, `status must be one of ${TRIP_STATUSES.join(', ')}`);
    data.status = status;
  }
  return data;
};

class TripService {
  // Non-members (or a missing/deleted group) get 404; VIEWERs may not create trips
  async createTrip(groupId, userId, body) {
    const membership = await travelGroupRepository.findActiveMembership(groupId, userId);
    if (!membership) throw httpError(404, 'Travel group not found.');
    if (membership.role === 'VIEWER') throw httpError(403, 'Viewers cannot create trips.');

    return await tripRepository.createTrip(groupId, userId, buildTripData(body || {}));
  }
}

module.exports = new TripService();
