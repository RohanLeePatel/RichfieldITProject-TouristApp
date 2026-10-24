// The frontend's trip API against a fake Prisma: auth, personal-group
// selection (never a shared group), the response shapes the frontend reads,
// and that unmatched paths fall through to the group routes.
// node src/routes/trips.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

process.env.JWT_ACCESS_SECRET = 'selfcheck-secret';

const calls = [];
let personalMembership = null; // what travelGroupMember.findFirst returns
let foundTrip = null; // what trip.findFirst returns

const fakePrisma = {
  travelGroupMember: {
    findFirst: async (args) => (calls.push(['travelGroupMember.findFirst', args]), personalMembership),
  },
  user: { findUnique: async () => ({ id: 7, fullName: 'Ada' }) },
  travelGroup: {
    create: async (args) => (calls.push(['travelGroup.create', args]), { id: 99 }),
  },
  trip: {
    create: async (args) => (calls.push(['trip.create', args]), { id: 1, ...args.data, members: undefined }),
    findMany: async (args) => (calls.push(['trip.findMany', args]), [
      { id: 1, title: 'Lima', description: '{"destination":"Lima","budget":500,"notes":null}', travelGroupId: 3, _count: { itineraries: 2 } },
      { id: 2, title: 'Group trip', description: 'plain text from the group API', travelGroupId: 4, _count: { itineraries: 0 } },
    ]),
    findFirst: async (args) => (calls.push(['trip.findFirst', args]), foundTrip),
    // a share that makes a new group answers with it, as Prisma's include would
    update: async (args) => (calls.push(['trip.update', args]), args.include?.travelGroup ? { travelGroup: { id: 50, ...args.data.travelGroup.create } } : {}),
  },
  itineraryItem: {
    create: async (args) => (calls.push(['itineraryItem.create', args]), args.data),
    deleteMany: async (args) => (calls.push(['itineraryItem.deleteMany', args]), { count: 1 }),
  },
};

// swap the real client for the fake before the router loads it
require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: fakePrisma };

const { generateAccessToken } = require('../auth/tokenService');
const router = require('./trips');

const app = express().use(express.json()).use('/api/trips', router);
app.use((req, res) => res.status(418).json({ fellThrough: true })); // stands in for the group routes

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/api/trips`;
  const auth = { authorization: `Bearer ${generateAccessToken({ id: 7, email: 'a@b.c' })}` };
  const json = { 'content-type': 'application/json' };
  const call = (p, init = {}) =>
    fetch(base + p, { ...init, headers: { ...auth, ...json, ...init.headers } }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const last = (name) => calls.filter(([n]) => n === name).at(-1)?.[1];

  try {
    // no token, no trips
    assert.equal((await fetch(base)).status, 401);

    // first personal trip: no personal group yet, so one is created
    let r = await call('/', { method: 'POST', body: JSON.stringify({ title: 'Lima', destination: 'Lima', budget: 500 }) });
    assert.equal(r.status, 201);
    assert.equal(r.body.trip.destination, 'Lima');
    assert.equal(r.body.trip.budget, 500);
    // the lookup only accepts an OWNER membership of a group with no invite code
    assert.deepEqual(last('travelGroupMember.findFirst').where, {
      userId: 7, role: 'OWNER', travelGroup: { inviteCode: null, deletedAt: null },
    });
    assert.equal(last('travelGroup.create').data.members.create.role, 'OWNER');
    assert.equal(last('trip.create').data.travelGroupId, 99);
    assert.equal(last('trip.create').data.members.create.role, 'ORGANIZER');

    // later trips reuse the personal group
    personalMembership = { travelGroupId: 3 };
    const groupsBefore = calls.filter(([n]) => n === 'travelGroup.create').length;
    await call('/', { method: 'POST', body: JSON.stringify({ title: 'B', destination: 'C' }) });
    assert.equal(calls.filter(([n]) => n === 'travelGroup.create').length, groupsBefore);
    assert.equal(last('trip.create').data.travelGroupId, 3);

    // validation still applies
    r = await call('/', { method: 'POST', body: JSON.stringify({ title: '' }) });
    assert.equal(r.status, 400);

    // a trip planned in a shared group: allowed for its non-viewer members only
    personalMembership = { travelGroupId: 12, role: 'MEMBER' };
    r = await call('/', { method: 'POST', body: JSON.stringify({ title: 'G', destination: 'D', travelGroupId: 12 }) });
    assert.equal(r.status, 201);
    assert.equal(last('trip.create').data.travelGroupId, 12);
    assert.deepEqual(last('travelGroupMember.findFirst').where, {
      userId: 7, travelGroupId: 12, role: { not: 'VIEWER' }, travelGroup: { deletedAt: null },
    });
    personalMembership = null; // not a member (or a viewer)
    r = await call('/', { method: 'POST', body: JSON.stringify({ title: 'G', destination: 'D', travelGroupId: 13 }) });
    assert.equal(r.status, 404);
    personalMembership = { travelGroupId: 3 };

    // the list covers personal and group trips, in the frontend's shape
    r = await call('/');
    assert.equal(r.status, 200);
    assert.equal(r.body.trips.length, 2);
    assert.deepEqual(r.body.trips[0]._count, { itinerary: 2 });
    assert.equal(r.body.trips[1].notes, 'plain text from the group API');
    assert.deepEqual(last('trip.findMany').where.OR, [
      { members: { some: { userId: 7 } } },
      { travelGroup: { members: { some: { userId: 7 } } } },
    ]);

    // one trip: itinerary under the frontend's key, plus members/destinations
    foundTrip = {
      id: 5, title: 'T', description: null, travelGroupId: 3, startDate: null,
      itineraries: [{ id: 'i1', title: 'Museum', dayNumber: 1, startTime: new Date('2000-01-01T09:30:00Z') }],
      members: [{ userId: 7 }], destinations: [],
    };
    r = await call('/5');
    assert.equal(r.status, 200);
    assert.equal(r.body.trip.itinerary[0].startTime, '09:30');
    assert.deepEqual(r.body.trip.members, [{ userId: 7 }]);
    assert.ok(last('trip.findFirst').include.itineraries);

    foundTrip = null;
    assert.equal((await call('/5')).status, 404);
    assert.equal((await call('/abc')).status, 400);

    // add/remove itinerary items, scoped to the trip
    foundTrip = { id: 5, startDate: '2026-10-01T00:00:00Z' };
    r = await call('/5/itinerary', { method: 'POST', body: JSON.stringify({ title: 'Lunch', dayNumber: 2, startTime: '12:15', lat: 1, lon: 2 }) });
    assert.equal(r.status, 201);
    assert.equal(r.body.item.startTime, '12:15');
    assert.equal(r.body.item.lat, 1);
    assert.equal(last('itineraryItem.create').data.startTime.toISOString(), '2026-10-02T12:15:00.000Z');
    r = await call('/5/itinerary/i1', { method: 'DELETE' });
    assert.equal(r.status, 200);
    assert.deepEqual(last('itineraryItem.deleteMany').where, { id: 'i1', tripId: 5 });

    // soft delete
    r = await call('/5', { method: 'DELETE' });
    assert.equal(r.status, 200);
    assert.ok(last('trip.update').data.deletedAt instanceof Date);

    // sharing a group trip: its existing join code, nothing moved
    foundTrip = { id: 5, title: 'Lima', travelGroup: { id: 12, name: 'Crew', inviteCode: 'AB12CD34' }, members: [] };
    r = await call('/5/share', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { inviteCode: 'AB12CD34', travelGroupId: 12, groupName: 'Crew' });
    assert.deepEqual(last('trip.findFirst').include.members, { where: { userId: 7, role: 'ORGANIZER' } });

    // a personal trip: only its organizer may share it, and it moves into a new group of its own
    foundTrip = { id: 5, title: 'Lima', travelGroup: { id: 3, name: 'Ada trips', inviteCode: null }, members: [] };
    assert.equal((await call('/5/share', { method: 'POST' })).status, 403);
    foundTrip.members = [{ userId: 7, role: 'ORGANIZER' }];
    r = await call('/5/share', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.equal(r.body.groupName, 'Lima group');
    assert.match(r.body.inviteCode, /^[0-9A-F]{8}$/);
    assert.deepEqual(last('trip.update').data.travelGroup.create.members, { create: { userId: 7, role: 'OWNER' } });

    // not ours: falls through to the group routes (itinerary list, budget, expenses)
    assert.equal((await call('/5/itinerary')).status, 418);
    assert.equal((await call('/5/budget')).status, 418);
    assert.equal((await call('/5/expenses')).status, 418);

    console.log('trips selfcheck: all assertions passed');
  } finally {
    server.close();
  }
});
