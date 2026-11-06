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

/**
 * The shared access gate for trip-scoped data, so the rule lives in one place rather
 * than in each service. Membership comes from a
 * direct TripMember row, or from membership of the trip's travel group (the same rule
 * GET /api/trips uses). Non-members get a 404 rather than a 403, so the response doesn't
 * reveal that a trip exists. VIEWER role gets a 403 on writes.
 * @param {number} tripId
 * @param {number} userId
 * @param {{ write?: boolean, denied?: string }} [options]
 * @returns {Promise<object>} the membership record
 */
const assertTripAccess = async (tripId, userId, { write = false, denied = 'Viewers cannot modify trip expenses or budget' } = {}) => {
  const membership = (await tripRepository.findActiveMembership(tripId, userId))
    || (await tripRepository.findGroupMembershipForTrip(tripId, userId));
  if (!membership) throw httpError(404, 'Trip not found');
  if (write && membership.role === 'VIEWER') {
    throw httpError(403, denied);
  }
  return membership;
};

module.exports = { httpError, parseId, assertTripAccess };
