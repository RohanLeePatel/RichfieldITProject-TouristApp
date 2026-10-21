const tripRepository = require('../repositories/tripRepository');

const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseId = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, `Invalid ${label}`);
  return id;
};

// Resolves the caller's trip membership - a TripMember row, else membership of
// the trip's travel group (same rule as GET /api/trips). Non-members get 404 so
// trip existence isn't leaked; VIEWERs are rejected for write operations.
const assertTripAccess = async (tripId, userId, { write = false } = {}) => {
  const membership = (await tripRepository.findActiveMembership(tripId, userId))
    || (await tripRepository.findGroupMembershipForTrip(tripId, userId));
  if (!membership) throw httpError(404, 'Trip not found');
  if (write && membership.role === 'VIEWER') {
    throw httpError(403, 'Viewers cannot modify trip expenses or budget');
  }
  return membership;
};

module.exports = { httpError, parseId, assertTripAccess };
