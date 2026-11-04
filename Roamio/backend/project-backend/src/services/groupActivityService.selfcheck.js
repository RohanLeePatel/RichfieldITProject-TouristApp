// Who hears about an invite or a trip edit, what they are told, and that edits
// are rate-limited per trip, against in-memory stand-ins for Prisma and push.
// node src/services/groupActivityService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const sent = [];
let failing = false;
require.cache[path.join(__dirname, '../config/prisma.js')] = {
  exports: {
    user: {
      findFirst: async ({ where }) => (where.email.equals === 'ann@example.com' ? { id: 5 } : null),
      findUnique: async () => ({ fullName: 'Sam Lee' }),
    },
    trip: {
      findFirst: async () => {
        if (failing) throw new Error('db down');
        return { title: 'Cape Town', members: [{ userId: 1 }, { userId: 2 }], travelGroup: { members: [{ userId: 2 }, { userId: 3 }] } };
      },
    },
  },
};
require.cache[path.join(__dirname, 'pushService.js')] = { exports: { notifyUser: async (userId, args) => sent.push({ userId, ...args }) } };

const { notifyInvite, notifyTripChange } = require('./groupActivityService');
const DAY = 86400000;

(async () => {
  // an invite to someone with an account reaches them, linking to the invite page
  const invite = { groupId: 8, groupName: 'Family', inviterName: 'Sam Lee', email: 'ann@example.com', token: 'tok', now: 20000 * DAY };
  assert.equal(await notifyInvite(invite), true);
  assert.deepEqual([sent[0].userId, sent[0].type, sent[0].topic, sent[0].url], [5, 'INVITE', 'groupActivity', '/invite/tok']);
  assert.equal(sent[0].title, 'Sam Lee invited you to "Family"');
  assert.equal(sent[0].dedupeKey, 'invite:8:5:20000');
  // no account for that email: nothing sent
  assert.equal(await notifyInvite({ ...invite, email: 'nobody@example.com' }), false);
  assert.equal(sent.length, 1);

  // a trip edit: trip and group members once each, never the person who made it
  sent.length = 0;
  const change = { tripId: 4, actorId: 2, what: 'changed the trip dates', now: 1000 * 30 * 60000 };
  assert.equal(await notifyTripChange(change), 2);
  assert.deepEqual(sent.map((n) => n.userId).sort(), [1, 3]);
  assert.equal(sent[0].title, '"Cape Town" was updated');
  assert.equal(sent[0].body, 'Sam Lee changed the trip dates.');
  assert.deepEqual([sent[0].topic, sent[0].url, sent[0].tripId], ['groupActivity', '/trips/4', 4]);
  // edits in the same 30 minutes share a key (the push service drops repeats); later ones don't
  const key = sent[0].dedupeKey;
  sent.length = 0;
  await notifyTripChange({ ...change, now: change.now + 29 * 60000 });
  assert.equal(sent[0].dedupeKey, key);
  sent.length = 0;
  await notifyTripChange({ ...change, now: change.now + 31 * 60000 });
  assert.notEqual(sent[0].dedupeKey, key);

  // the lookup failing never throws into the edit
  failing = true;
  assert.equal(await notifyTripChange(change), 0);

  console.log('groupActivityService selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
