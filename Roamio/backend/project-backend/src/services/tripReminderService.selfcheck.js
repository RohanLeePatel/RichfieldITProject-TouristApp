// Which trips get a 7-day and 1-day reminder, and what they say, against
// in-memory stand-ins for Prisma and the push service.
// node src/services/tripReminderService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const queries = [];
const sent = [];
const trips = { 7: [{ id: 4, title: 'Cape Town', members: [{ userId: 1 }, { userId: 2 }] }], 1: [{ id: 9, title: 'Durban', members: [{ userId: 3 }] }] };
require.cache[path.join(__dirname, '../config/prisma.js')] = {
  exports: {
    trip: {
      findMany: async ({ where }) => {
        queries.push(where);
        const days = (where.startDate.gte.getTime() - Date.UTC(2026, 10, 2)) / 86400000;
        return trips[days] || [];
      },
    },
  },
};
require.cache[path.join(__dirname, 'pushService.js')] = { exports: { notifyUser: async (userId, args) => sent.push({ userId, ...args }) } };

const { sendTripReminders } = require('./tripReminderService');

(async () => {
  // run at 07:00 UTC on 2 Nov: trips starting on the 9th (7 days) and the 3rd (1 day)
  const result = await sendTripReminders(new Date('2026-11-02T07:00:00Z'));
  assert.equal(result.tripsReminded, 2);

  assert.equal(queries.length, 2);
  assert.equal(queries[0].startDate.gte.toISOString(), '2026-11-09T00:00:00.000Z');
  assert.equal(queries[0].startDate.lt.toISOString(), '2026-11-10T00:00:00.000Z');
  assert.equal(queries[1].startDate.gte.toISOString(), '2026-11-03T00:00:00.000Z');
  // not deleted, not finished or cancelled
  assert.equal(queries[0].deletedAt, null);
  assert.deepEqual(queries[0].status, { notIn: ['COMPLETED', 'CANCELLED'] });

  // every member of each trip, once, on the right topic and with a link to the trip
  assert.deepEqual(sent.map((n) => n.userId), [1, 2, 3]);
  assert.equal(sent[0].title, '"Cape Town" starts in 7 days');
  assert.equal(sent[2].title, '"Durban" starts tomorrow');
  assert.deepEqual([sent[0].topic, sent[0].url, sent[0].tripId], ['travelUpdates', '/trips/4', 4]);
  assert.equal(sent[0].dedupeKey, 'reminder:4:7');
  assert.equal(sent[2].dedupeKey, 'reminder:9:1');

  // nothing starting on either day: nothing sent
  sent.length = 0;
  assert.equal((await sendTripReminders(new Date('2026-12-20T07:00:00Z'))).tripsReminded, 0);
  assert.equal(sent.length, 0);

  console.log('tripReminderService selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
