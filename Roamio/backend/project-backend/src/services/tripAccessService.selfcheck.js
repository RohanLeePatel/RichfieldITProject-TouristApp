// Trip access (B3): a TripMember row, else the trip's group membership; group
// VIEWERs still can't write; strangers get the same 404 as a missing trip.
// node src/services/tripAccessService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const tripMembers = { '1:7': { role: 'ORGANIZER' } }; // trip 1: user 7 is on it
const groupMembers = { '1:8': { role: 'MEMBER' }, '1:9': { role: 'VIEWER' } }; // users 8, 9 via the group
require.cache[path.join(__dirname, '../repositories/tripRepository.js')] = {
  exports: {
    findActiveMembership: async (tripId, userId) => tripMembers[`${tripId}:${userId}`] || null,
    findGroupMembershipForTrip: async (tripId, userId) => groupMembers[`${tripId}:${userId}`] || null,
  },
};
const { assertTripAccess } = require('./tripAccessService');

(async () => {
  assert.equal((await assertTripAccess(1, 7, { write: true })).role, 'ORGANIZER');
  assert.equal((await assertTripAccess(1, 8, { write: true })).role, 'MEMBER'); // group member: was a 404
  assert.equal((await assertTripAccess(1, 9)).role, 'VIEWER');
  await assert.rejects(assertTripAccess(1, 9, { write: true }), { statusCode: 403 });
  await assert.rejects(assertTripAccess(1, 99), { statusCode: 404 });
  console.log('tripAccess selfcheck: all assertions passed');
})();
