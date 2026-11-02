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
let tripRole = 'ORGANIZER'; // the caller's TripMember role, for the viewer checks

const fakePrisma = {
  travelGroupMember: {
    findFirst: async (args) => (calls.push(['travelGroupMember.findFirst', args]), personalMembership),
  },
  tripMember: { findFirst: async () => ({ role: tripRole }) },
  $transaction: async (ops) => Promise.all(ops),
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
    update: async (args) => (calls.push(['trip.update', args]), args.include?.travelGroup ? { travelGroup: { id: 50, ...args.data.travelGroup.create } } : { id: 5, title: 'T', ...args.data }),
  },
  itineraryItem: {
    create: async (args) => (calls.push(['itineraryItem.create', args]), args.data),
    deleteMany: async (args) => (calls.push(['itineraryItem.deleteMany', args]), { count: 1 }),
    update: async (args) => (calls.push(['itineraryItem.update', args]), args),
  },
};

// swap the real client for the fake before the router loads it
require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: fakePrisma };
require.cache[path.join(__dirname, '../prismaClient.js')] = { exports: fakePrisma }; // the access check reads through this one
require.cache[path.join(__dirname, '../services/groupActivityService.js')] = { exports: { notifyTripChange: async () => 0 } }; // tested in its own selfcheck

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

    // a viewer reads a trip but changes nothing in it
    tripRole = 'VIEWER';
    for (const [method, p, body] of [['POST', '/5/itinerary', { title: 'x' }], ['DELETE', '/5/itinerary/i1'], ['DELETE', '/5'],
      ['PATCH', '/5', { title: 'x' }], ['PUT', '/5/itinerary/order', { days: [{ dayNumber: 1, itemIds: [] }] }]]) {
      assert.equal((await call(p, { method, ...(body ? { body: JSON.stringify(body) } : {}) })).status, 403, method + ' ' + p);
    }
    tripRole = 'ORGANIZER';

    // editing a saved trip: unsent fields keep their value; dates come in pairs, 1-30 days
    foundTrip = {
      id: 5, title: 'Old', description: '{"destination":"Lima","budget":500,"notes":"n","currency":"USD"}',
      startDate: new Date('2026-10-01T00:00:00Z'),
      itineraries: [
        { id: 'a', dayNumber: 1, startTime: new Date('2026-10-01T09:00:00Z') },
        { id: 'b', dayNumber: 3, startTime: new Date('2026-10-03T14:30:00Z') },
      ],
    };
    r = await call('/5', { method: 'PATCH', body: JSON.stringify({ title: 'New', budget: 900 }) });
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(last('trip.update').data.description), { destination: 'Lima', budget: 900, notes: 'n', currency: 'USD' });
    assert.equal(last('trip.update').data.title, 'New');
    assert.equal(last('trip.update').data.startDate, undefined);
    assert.equal((await call('/5', { method: 'PATCH', body: JSON.stringify({ startDate: '2026-11-01' }) })).status, 400);
    assert.equal((await call('/5', { method: 'PATCH', body: JSON.stringify({ startDate: '2026-11-05', endDate: '2026-11-01' }) })).status, 400);
    assert.equal((await call('/5', { method: 'PATCH', body: JSON.stringify({ startDate: '2026-11-01', endDate: '2026-12-15' }) })).status, 400);
    r = await call('/5', { method: 'PATCH', body: JSON.stringify({ startDate: '2026-11-01', endDate: '2026-11-02' }) });
    assert.equal(r.status, 409); // stop b is on day 3
    assert.deepEqual(r.body.items.map((item) => item.id), ['b']);
    r = await call('/5', { method: 'PATCH', body: JSON.stringify({ startDate: '2026-11-01', endDate: '2026-11-03' }) });
    assert.equal(r.status, 200);
    // every stop keeps its day and time of day, on the new calendar dates
    const moved = calls.filter(([n]) => n === 'itineraryItem.update').slice(-2).map(([, a]) => [a.where.id, a.data.startTime.toISOString()]);
    assert.deepEqual(moved, [['a', '2026-11-01T09:00:00.000Z'], ['b', '2026-11-03T14:30:00.000Z']]);

    // reordering: a day keeps its time slots, handed out in the new order; stops can change day
    foundTrip = {
      id: 5, startDate: new Date('2026-10-01T00:00:00Z'),
      itineraries: [
        { id: 'a', dayNumber: 1, startTime: new Date('2026-10-01T09:00:00Z') },
        { id: 'b', dayNumber: 1, startTime: new Date('2026-10-01T14:00:00Z') },
        { id: 'c', dayNumber: 2, startTime: new Date('2026-10-02T10:00:00Z') },
      ],
    };
    const before = calls.length;
    r = await call('/5/itinerary/order', { method: 'PUT', body: JSON.stringify({ days: [{ dayNumber: 1, itemIds: ['b', 'c'] }, { dayNumber: 2, itemIds: ['a'] }] }) });
    assert.equal(r.status, 200);
    assert.deepEqual(
      calls.slice(before).filter(([n]) => n === 'itineraryItem.update').map(([, a]) => [a.where.id, a.data.dayNumber, a.data.startTime.toISOString()]),
      [['b', 1, '2026-10-01T10:00:00.000Z'], ['c', 1, '2026-10-01T14:00:00.000Z'], ['a', 2, '2026-10-02T09:00:00.000Z']]
    );
    assert.equal((await call('/5/itinerary/order', { method: 'PUT', body: JSON.stringify({ days: [{ dayNumber: 1, itemIds: ['zzz'] }] }) })).status, 400);
    assert.equal((await call('/5/itinerary/order', { method: 'PUT', body: JSON.stringify({ days: [{ dayNumber: 1, itemIds: ['a', 'a'] }] }) })).status, 400);

    // deleted trips: listed for 30 days, restored by anyone but a viewer
    r = await call('/deleted');
    assert.equal(r.status, 200);
    assert.ok(last('trip.findMany').where.deletedAt.gte instanceof Date);
    foundTrip = { id: 5, title: 'T', members: [], travelGroup: { members: [{ role: 'VIEWER' }] } };
    assert.equal((await call('/5/restore', { method: 'POST' })).status, 403);
    foundTrip.travelGroup.members = [{ role: 'MEMBER' }];
    r = await call('/5/restore', { method: 'POST' });
    assert.equal(r.status, 200);
    assert.equal(last('trip.update').data.deletedAt, null);
    foundTrip = null;
    assert.equal((await call('/5/restore', { method: 'POST' })).status, 404);

    // soft delete
    foundTrip = { id: 5, startDate: '2026-10-01T00:00:00Z' };
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
