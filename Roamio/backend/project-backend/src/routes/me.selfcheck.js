// The Settings API over HTTP against an in-memory stand-in for Prisma:
// /api/users/me/... (notification preferences, sessions, sign-in history, saved
// travellers, data export, account deletion) and /api/support/reports. It checks
// that everything is scoped to the signed-in traveller, that passport and ID
// numbers are never kept, that consent is required, and that deleting an
// account needs the password and leaves other people's groups intact.
// node src/routes/me.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

process.env.JWT_ACCESS_SECRET = 'selfcheck-secret';
delete process.env.superSecretKey; // no translation service to call

/* ---------- in-memory Prisma ---------- */

const db = {
  users: [
    { id: 1, email: 'ada@example.com', fullName: 'Ada', passwordHash: null, deletedAt: null },
    { id: 2, email: 'bob@example.com', fullName: 'Bob', passwordHash: 'x', deletedAt: null },
  ],
  prefs: [],
  drafts: [],
  sessions: [],
  events: [],
  travellers: [],
  members: [], // { id, travelGroupId, userId, role, joinedAt }
  groups: [], // { id, description }
  trips: [],
  expenses: [],
  invitations: [],
  notifications: [],
  logs: [],
  chats: [],
  reviews: [],
  documents: [], // { id, uploadedById }
};
let nextId = 100;

const matches = (row, where = {}) =>
  Object.entries(where).every(([key, want]) => {
    const have = row[key];
    if (want && typeof want === 'object' && !(want instanceof Date)) {
      if ('not' in want) return have !== want.not;
      if ('in' in want) return want.in.includes(have);
      if ('gte' in want) return have >= want.gte;
      if ('lt' in want) return have < want.lt;
      return false;
    }
    return have === want;
  });
const select = (rows, where) => rows.filter((row) => matches(row, where));
const removeWhere = (rows, where) => {
  const keep = rows.filter((row) => !matches(row, where));
  const count = rows.length - keep.length;
  rows.splice(0, rows.length, ...keep);
  return { count };
};

const prisma = {
  user: {
    // like Prisma, only the selected columns come back
    findFirst: async ({ where, select }) => {
      const user = db.users.find((u) => u.id === where.id && !u.deletedAt);
      if (!user || !select) return user || null;
      return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, user[key]]));
    },
    delete: async ({ where }) => {
      removeWhere(db.users, { id: where.id });
      for (const table of [db.sessions, db.travellers, db.members]) removeWhere(table, { userId: where.id });
      removeWhere(db.expenses, { paidById: where.id });
    },
  },
  plannerDraft: {
    findUnique: async ({ where }) => db.drafts.find((d) => d.userId === where.userId) || null,
    upsert: async ({ where, create, update }) => {
      const row = db.drafts.find((d) => d.userId === where.userId);
      if (row) Object.assign(row, update);
      else db.drafts.push({ ...create });
    },
    deleteMany: async ({ where }) => { db.drafts = db.drafts.filter((d) => d.userId !== where.userId); },
  },
  notificationPreference: {
    findUnique: async ({ where }) => db.prefs.find((p) => p.userId === where.userId) || null,
    upsert: async ({ where, create, update }) => {
      const row = db.prefs.find((p) => p.userId === where.userId);
      if (row) Object.assign(row, update);
      else db.prefs.push({ ...create });
    },
  },
  userSession: {
    create: async ({ data }) => db.sessions.push({ createdAt: new Date(), lastSeenAt: new Date(), revokedAt: null, ...data }),
    findMany: async ({ where }) => select(db.sessions, where).sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    count: async ({ where }) => select(db.sessions, where).length,
    updateMany: async ({ where, data }) => {
      const rows = select(db.sessions, where);
      rows.forEach((row) => Object.assign(row, data));
      return { count: rows.length };
    },
  },
  loginEvent: {
    create: async ({ data }) => db.events.push({ id: nextId++, at: new Date(), ...data }),
    deleteMany: async ({ where }) => removeWhere(db.events, where),
    findMany: async ({ where }) => select(db.events, where).sort((a, b) => b.at - a.at),
  },
  savedTraveller: {
    findMany: async ({ where }) => select(db.travellers, where),
    count: async ({ where }) => select(db.travellers, where).length,
    findFirst: async ({ where }) => select(db.travellers, where)[0] || null,
    create: async ({ data }) => { const row = { createdAt: new Date(), ...data }; db.travellers.push(row); return row; },
    update: async ({ where, data }) => Object.assign(db.travellers.find((t) => t.id === where.id), data),
    deleteMany: async ({ where }) => removeWhere(db.travellers, where),
  },
  travelGroupMember: {
    findMany: async ({ where, include }) => {
      const rows = db.members.filter((m) => (where.userId?.not ? m.travelGroupId === where.travelGroupId && m.userId !== where.userId.not : matches(m, where)));
      return include ? rows.map((m) => ({ ...m, travelGroup: { id: m.travelGroupId, name: 'Trip crew', description: null, members: [], trips: [] } })) : rows;
    },
    update: async ({ where, data }) => Object.assign(db.members.find((m) => m.id === where.id), data),
  },
  trip: {
    findMany: async ({ where: { OR: [{ members: { some } }, { travelGroup }] } }) =>
      db.trips.filter((trip) => {
        const members = db.members.filter((member) => member.travelGroupId === trip.travelGroupId);
        return trip.members.some((member) => matches(member, some)) ||
          (members.some((member) => matches(member, travelGroup.members.some)) &&
            members.every((member) => matches(member, travelGroup.members.every)));
      }),
    deleteMany: async ({ where }) => {
      const tripIds = select(db.trips, where).map(({ id }) => id);
      removeWhere(db.trips, where);
      for (const table of [db.documents, db.expenses]) removeWhere(table, { tripId: { in: tripIds } });
    },
    updateMany: async ({ where: { splitShares: { path: [id], gte } }, data }) => {
      db.trips.filter((trip) => trip.splitShares?.[id] >= gte).forEach((trip) => Object.assign(trip, data));
    },
  },
  travelGroup: {
    delete: async ({ where }) => { removeWhere(db.groups, { id: where.id }); removeWhere(db.members, { travelGroupId: where.id }); },
  },
  tripDocument: {
    findMany: async () => [],
    deleteMany: async ({ where }) => removeWhere(db.documents, where),
  },
  invitation: { deleteMany: async ({ where }) => removeWhere(db.invitations, where) },
  notification: { findMany: async () => [], deleteMany: async ({ where }) => removeWhere(db.notifications, where) },
  chatConversation: { findMany: async () => [], deleteMany: async ({ where }) => removeWhere(db.chats, where) },
  activityLog: { deleteMany: async ({ where }) => removeWhere(db.logs, where) },
  placeReview: { deleteMany: async ({ where }) => removeWhere(db.reviews, where) },
};
prisma.$transaction = async (fn) => {
  const snapshot = JSON.stringify(db);
  try {
    return await fn(prisma);
  } catch (error) {
    Object.assign(db, JSON.parse(snapshot, (k, v) => (/At$|^at$|joinedAt/.test(k) && typeof v === 'string' ? new Date(v) : v)));
    throw error;
  }
};
require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: prisma };
// the signed-in account's own address, for support reports
require.cache[path.join(__dirname, '../repositories/userRepository.js')] = {
  exports: { findById: async (id) => db.users.find((u) => u.id === id) || null },
};
// the report email is checked at its edge: what would have been sent
const mail = [];
require.cache[path.join(__dirname, '../services/emailService.js')] = { exports: { sendSupportReport: async (m) => { mail.push(m); } } };

const tokenService = require('../auth/tokenService');
const meRoutes = require('./me');
const supportRoutes = require('./support');

const app = express().use(express.json()).use('/api/users/me', meRoutes).use('/api/support', supportRoutes);

const day = 24 * 60 * 60 * 1000;
const validTraveller = {
  firstName: 'Priya', lastName: 'Goindsamy', relationship: 'Partner or spouse', dateOfBirth: '1996-04-12',
  nationality: 'South African', email: 'priya@example.com', phone: '+27 82 123 4567', documentType: 'passport',
  documentNumber: 'a-1234 5678', documentExpiry: '2031-08-01', consent: { given: true, guardian: false },
};

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, p, { body, token = tokenFor(1, 'sess-1') } = {}) =>
    fetch(base + p, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (res) => ({ status: res.status, headers: res.headers, body: res.status === 204 ? null : await res.json().catch(() => null) }));
  function tokenFor(id, sid) { return tokenService.generateAccessToken({ id, email: `u${id}@example.com` }, sid); }

  db.users[0].passwordHash = await tokenService.hashPassword('correct-horse');
  // the tokens below carry these session ids, and requireAuth checks the session is live
  const seeded = new Date();
  db.sessions.push(
    { id: 'sess-1', userId: 1, browser: 'Chrome', os: 'Windows', deviceType: 'desktop', location: 'Durban, South Africa', ipAddress: '102.65.12.4', createdAt: seeded, lastSeenAt: seeded, revokedAt: null },
    { id: 's2', userId: 2, browser: 'Chrome', os: 'Windows', deviceType: 'desktop', location: '', ipAddress: '', createdAt: seeded, lastSeenAt: seeded, revokedAt: null },
  );
  const realError = console.error;
  console.error = () => {};

  try {
    // nothing is open to the public
    for (const [method, p] of [['GET', '/api/users/me/notification-preferences'], ['GET', '/api/users/me/sessions'], ['GET', '/api/users/me/travellers'], ['GET', '/api/users/me/export'], ['DELETE', '/api/users/me'], ['POST', '/api/support/reports']]) {
      assert.equal((await call(method, p, { token: null })).status, 401, `${method} ${p}`);
    }

    /* ---- notification preferences ---- */
    let r = await call('GET', '/api/users/me/notification-preferences');
    assert.equal(r.body.channels.email, true);
    assert.equal(r.body.channels.browser, false);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal((await call('PUT', '/api/users/me/notification-preferences', { body: { channels: { email: 'yes' } } })).status, 400);
    r = await call('PUT', '/api/users/me/notification-preferences', { body: { channels: { browser: true }, topics: { flightChanges: { email: false }, bogus: { email: false } } } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.channels, { email: true, browser: true });
    assert.equal(r.body.topics.flightChanges.email, false);
    assert.equal(r.body.topics.flightChanges.browser, true); // left out -> default
    assert.equal(r.body.topics.bogus, undefined); // unknown topics aren't stored
    assert.equal((await call('GET', '/api/users/me/notification-preferences')).body.topics.flightChanges.email, false);
    // another traveller still sees the defaults
    assert.equal((await call('GET', '/api/users/me/notification-preferences', { token: tokenFor(2, 's2') })).body.topics.flightChanges.email, true);

    /* ---- sessions and sign-in history ---- */
    const now = new Date();
    Object.assign(db.sessions.find((s) => s.id === 'sess-1'), { createdAt: now, lastSeenAt: now });
    db.sessions.push(
      { id: 'sess-2', userId: 1, browser: 'Safari', os: 'iOS', deviceType: 'mobile', location: '', ipAddress: '10.0.0.2', createdAt: now, lastSeenAt: new Date(now - 1000), revokedAt: null },
      { id: 'sess-old', userId: 1, browser: 'Firefox', os: 'Linux', deviceType: 'desktop', location: '', ipAddress: '', createdAt: now, lastSeenAt: new Date(now - 9 * day), revokedAt: null }, // unused for over a week
      { id: 'sess-3', userId: 2, browser: 'Edge', os: 'Windows', deviceType: 'desktop', location: '', ipAddress: '', createdAt: now, lastSeenAt: now, revokedAt: null }
    );
    r = await call('GET', '/api/users/me/sessions');
    assert.deepEqual(r.body.map((s) => [s.id, s.current]), [['sess-1', true], ['sess-2', false]]); // not Bob's, not the stale one
    assert.equal(r.body[0].lastActiveAt, now.toISOString());
    // one that is not yours (or already over) is a 404, never someone else's
    assert.equal((await call('DELETE', '/api/users/me/sessions/sess-3')).status, 404);
    assert.equal(db.sessions.find((s) => s.id === 'sess-3').revokedAt, null);
    db.sessions.push({ id: 'sess-4', userId: 1, browser: 'Chrome', os: 'Android', deviceType: 'mobile', location: '', ipAddress: '', createdAt: now, lastSeenAt: now, revokedAt: null });
    assert.equal((await call('DELETE', '/api/users/me/sessions/sess-4')).status, 204);
    // a signed-out session's access token stops working at once, not when it expires
    assert.equal((await call('GET', '/api/users/me/sessions', { token: tokenFor(1, 'sess-4') })).status, 401);
    assert.equal((await call('DELETE', '/api/users/me/sessions/sess-4')).status, 404);
    // "sign out everywhere else" keeps the one making the request
    assert.equal((await call('DELETE', '/api/users/me/sessions/others')).status, 204);
    assert.deepEqual((await call('GET', '/api/users/me/sessions')).body.map((s) => s.id), ['sess-1']);
    assert.equal(db.sessions.find((s) => s.id === 'sess-3').revokedAt, null); // Bob is untouched

    db.events.push(
      { id: 1, userId: 1, at: new Date(now - 2 * day), success: true, browser: 'Chrome', os: 'Windows', deviceType: 'desktop', location: '', ipAddress: '' },
      { id: 2, userId: 1, at: new Date(now - 1 * day), success: false, browser: 'Unknown', os: 'Linux', deviceType: 'desktop', location: '', ipAddress: '1.2.3.4' },
      { id: 3, userId: 1, at: new Date(now - 40 * day), success: true, browser: 'Chrome', os: 'Windows', deviceType: 'desktop', location: '', ipAddress: '' },
      { id: 4, userId: 2, at: now, success: true, browser: 'Edge', os: 'Windows', deviceType: 'desktop', location: '', ipAddress: '' }
    );
    r = await call('GET', '/api/users/me/login-activity');
    assert.deepEqual(r.body.map((e) => [e.id, e.success]), [['2', false], ['1', true]]); // newest first, last 30 days, only yours

    /* ---- saved travellers ---- */
    r = await call('POST', '/api/users/me/travellers', { body: validTraveller });
    assert.equal(r.status, 201);
    const saved = r.body;
    assert.equal(saved.documentLast4, '5678');
    assert.equal(saved.dateOfBirth, '1996-04-12');
    assert.equal(saved.consent.guardian, false);
    assert.ok(saved.consent.at);
    // the number itself is nowhere: not in the answer, not in the row
    assert.ok(!JSON.stringify(saved).includes('12345678') && !JSON.stringify(db.travellers).includes('12345678'));
    assert.equal(saved.documentNumber, undefined);

    for (const [change, pattern] of [
      [{ firstName: 'R2D2' }, /first name/],
      [{ relationship: 'Nemesis' }, /how you know/],
      [{ dateOfBirth: '2999-01-01' }, /date of birth/],
      [{ dateOfBirth: '1996-02-31' }, /date of birth/],
      [{ email: 'nope' }, /email/],
      [{ phone: 'abc' }, /phone/],
      [{ documentType: 'visa' }, /passport or an ID/],
      [{ documentNumber: '12' }, /5-20/],
      [{ documentExpiry: '1990-01-01' }, /expiry/],
      [{ consent: { given: false } }, /permission/],
      [{ consent: undefined }, /permission/],
      [{ dateOfBirth: new Date(Date.now() - 5 * 365 * day).toISOString().slice(0, 10), consent: { given: true, guardian: false } }, /guardian/], // a child needs a guardian
    ]) {
      r = await call('POST', '/api/users/me/travellers', { body: { ...validTraveller, ...change } });
      assert.equal(r.status, 400, JSON.stringify(change));
      assert.match(r.body.message, pattern);
    }
    // with the guardian's word, a child is fine and is marked as one
    r = await call('POST', '/api/users/me/travellers', { body: { ...validTraveller, firstName: 'Kai', dateOfBirth: new Date(Date.now() - 5 * 365 * day).toISOString().slice(0, 10), consent: { given: true, guardian: true }, documentNumber: undefined } });
    assert.equal(r.status, 201);
    assert.equal(r.body.consent.guardian, true);
    assert.equal(r.body.documentLast4, null);

    // an update that leaves the number blank keeps the saved digits and the original consent date
    r = await call('PUT', `/api/users/me/travellers/${saved.id}`, { body: { ...validTraveller, lastName: 'Naidoo', documentNumber: '', consent: { given: true, guardian: false, at: '1999-01-01T00:00:00Z' } } });
    assert.equal(r.status, 200);
    assert.equal(r.body.lastName, 'Naidoo');
    assert.equal(r.body.documentLast4, '5678');
    assert.equal(r.body.consent.at, saved.consent.at);
    // a new number replaces them
    r = await call('PUT', `/api/users/me/travellers/${saved.id}`, { body: { ...validTraveller, documentNumber: 'ZZ99 0001' } });
    assert.equal(r.body.documentLast4, '0001');

    // someone else's traveller is invisible: list, update and delete
    const bob = { token: tokenFor(2, 's2') };
    assert.deepEqual((await call('GET', '/api/users/me/travellers', bob)).body, []);
    assert.equal((await call('PUT', `/api/users/me/travellers/${saved.id}`, { ...bob, body: validTraveller })).status, 404);
    assert.equal((await call('DELETE', `/api/users/me/travellers/${saved.id}`, bob)).status, 404);
    assert.equal(db.travellers.length, 2);

    assert.equal((await call('DELETE', `/api/users/me/travellers/${saved.id}`)).status, 204);
    assert.equal((await call('GET', '/api/users/me/travellers')).body.length, 1);
    // a sensible ceiling on how many
    while (db.travellers.length < 20) db.travellers.push({ id: `x${db.travellers.length}`, userId: 1, createdAt: new Date() });
    assert.match((await call('POST', '/api/users/me/travellers', { body: validTraveller })).body.message, /up to 20/);
    removeWhere(db.travellers, { userId: 1 });

    /* ---- download my data ---- */
    r = await call('GET', '/api/users/me/export');
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-disposition'), /^attachment; filename="roamio-export-\d{4}-\d{2}-\d{2}\.json"$/);
    assert.equal(r.body.profile.email, 'ada@example.com');
    assert.deepEqual(r.body.notificationPreferences.channels, { email: true, browser: true });
    assert.deepEqual(Object.keys(r.body).sort(), ['assistantChats', 'documentsYouUploaded', 'exportedAt', 'format', 'groups', 'notificationPreferences', 'notifications', 'profile', 'savedTravellers', 'signInHistory', 'translationHistory'].sort());
    assert.ok(!JSON.stringify(r.body).includes('passwordHash'));

    /* ---- planner draft: one per traveller, private ---- */
    assert.equal((await call('GET', '/api/users/me/planner-draft')).status, 200);
    assert.equal((await call('GET', '/api/users/me/planner-draft')).body.draft, null);
    assert.equal((await call('PUT', '/api/users/me/planner-draft', { body: [1] })).status, 400);
    assert.equal((await call('PUT', '/api/users/me/planner-draft', { body: { pad: 'x'.repeat(1_000_001) } })).status, 413);
    assert.equal((await call('PUT', '/api/users/me/planner-draft', { body: { stage: 'itinerary', step: 2 } })).status, 200);
    assert.equal((await call('GET', '/api/users/me/planner-draft')).body.draft.stage, 'itinerary');
    assert.equal((await call('GET', '/api/users/me/planner-draft', { token: tokenFor(2, 's2') })).body.draft, null);
    assert.equal((await call('DELETE', '/api/users/me/planner-draft')).status, 200);
    assert.equal((await call('GET', '/api/users/me/planner-draft')).body.draft, null);
    assert.equal((await call('GET', '/api/users/me/planner-draft', { token: null })).status, 401);

    /* ---- delete my account ---- */
    // a group Ada is alone in, a group she owns with Bob in it, and one Bob owns
    const joined = (days) => new Date(now - days * day);
    db.groups.push({ id: 10 }, { id: 11 }, { id: 12 });
    db.members.push(
      { id: 1, travelGroupId: 10, userId: 1, role: 'OWNER', joinedAt: joined(9) },
      { id: 2, travelGroupId: 11, userId: 1, role: 'OWNER', joinedAt: joined(9) },
      { id: 3, travelGroupId: 11, userId: 2, role: 'MEMBER', joinedAt: joined(5) },
      { id: 4, travelGroupId: 12, userId: 2, role: 'OWNER', joinedAt: joined(8) },
      { id: 5, travelGroupId: 12, userId: 1, role: 'MEMBER', joinedAt: joined(2) }
    );
    db.trips.push(
      { id: 20, travelGroupId: 10, members: [] }, // legacy personal trip
      { id: 21, travelGroupId: 11, deletedAt: joined(1), members: [{ userId: 1, role: 'ORGANIZER' }] },
      { id: 22, travelGroupId: 11, members: [{ userId: 2, role: 'ORGANIZER' }], splitShares: { 1: 0, 2: 100 } },
      { id: 23, travelGroupId: 12, members: [{ userId: 1, role: 'ORGANIZER' }, { userId: 2, role: 'COLLABORATOR' }] }
    );
    db.documents.push(
      { id: 'd1', tripId: 22, uploadedById: 1 },
      { id: 'd2', tripId: 22, uploadedById: 2 },
      { id: 'd3', tripId: 23, uploadedById: 2 }
    );
    db.expenses.push({ tripId: 22, paidById: 1 }, { tripId: 22, paidById: 2 }, { tripId: 23, paidById: 2 });
    db.invitations.push({ email: 'ada@example.com' }, { email: 'bob@example.com' });
    for (const table of [db.notifications, db.chats, db.logs, db.reviews]) {
      table.push({ tripId: 21, userId: 2 }, { tripId: 22, userId: 2 });
    }

    for (const [body, status, pattern] of [
      [undefined, 400, /DELETE/],
      [{ confirmation: 'delete', password: 'correct-horse' }, 400, /DELETE/],
      [{ confirmation: 'DELETE' }, 400, /password/],
      [{ confirmation: 'DELETE', password: 'wrong' }, 401, /Password is incorrect/],
    ]) {
      r = await call('DELETE', '/api/users/me', { body });
      assert.equal(r.status, status);
      assert.match(r.body.message, pattern);
      assert.equal(db.users.length, 2); // nothing was deleted
    }

    // A missing configuration, route or service must leave the account intact.
    const deletion = { body: { confirmation: 'DELETE', password: 'correct-horse' } };
    r = await call('DELETE', '/api/users/me', deletion);
    assert.equal(r.status, 502);
    process.env.superSecretKey = 'service-key';
    const realFetch = global.fetch;
    for (const status of [404, 503]) {
      global.fetch = async (url, init) => (String(url).includes('/api/translate/history') ? { ok: false, status } : realFetch(url, init));
      r = await call('DELETE', '/api/users/me', deletion);
      assert.equal(r.status, 502);
      assert.equal(db.users.length, 2);
      assert.equal(db.trips.length, 4);
    }
    // ...and when it answers, it was asked for this traveller only
    let asked;
    global.fetch = async (url, init) => (String(url).includes('/api/translate/history') ? ((asked = { url: String(url), init }), { ok: true, status: 200 }) : realFetch(url, init));

    r = await call('DELETE', '/api/users/me', deletion);
    assert.equal(r.status, 204);
    assert.equal(asked.init.method, 'DELETE');
    assert.equal(asked.init.headers['x-user-id'], '1');
    global.fetch = realFetch;
    delete process.env.superSecretKey;

    assert.deepEqual(db.users.map((u) => u.id), [2]);
    assert.deepEqual(db.groups.map((g) => g.id), [11, 12]); // the group only Ada was in is gone, the shared ones stay
    assert.equal(db.members.find((m) => m.travelGroupId === 11 && m.userId === 2).role, 'OWNER'); // Bob inherits the group Ada owned
    assert.equal(db.members.find((m) => m.travelGroupId === 12 && m.userId === 2).role, 'OWNER');
    assert.deepEqual(db.documents.map((d) => d.id), ['d2']);
    assert.deepEqual(db.trips.map((trip) => trip.id), [22]);
    assert.deepEqual(db.trips[0].splitShares, {});
    assert.deepEqual(db.expenses, [{ tripId: 22, paidById: 2 }]);
    assert.deepEqual(db.invitations, [{ email: 'bob@example.com' }]);
    for (const table of [db.notifications, db.chats, db.logs, db.reviews]) {
      assert.deepEqual(table, [{ tripId: 22, userId: 2 }]);
    }
    assert.equal(db.sessions.some((s) => s.userId === 1), false);
    assert.equal((await call('GET', '/api/users/me/sessions')).status, 401);
    assert.match(r.headers.get('set-cookie') || '', /refreshToken=;/); // signed out too

    /* ---- report a problem ---- */
    const report = { category: "Something isn't working", subject: 'Map will not load', description: 'The map on my trip page stays blank after I open it.', email: 'bob@example.com', context: { page: '/settings', browser: 'Chrome on Windows', injected: 'x'.repeat(5) } };
    const asBob = { token: tokenFor(2, 's2') };
    for (const [change, pattern] of [[{ category: 'Spam' }, /about/], [{ subject: 'hey' }, /summary/], [{ description: 'too short' }, /more/], [{ description: 'x'.repeat(4001) }, /4000/]]) {
      r = await call('POST', '/api/support/reports', { ...asBob, body: { ...report, ...change } });
      assert.equal(r.status, 400);
      assert.match(r.body.message, pattern);
    }
    assert.equal(mail.length, 0);
    r = await call('POST', '/api/support/reports', { ...asBob, body: report });
    assert.equal(r.status, 201);
    assert.match(r.body.reference, /^RM-\d{5}$/);
    assert.equal(mail.length, 1);
    assert.equal(mail[0].reference, r.body.reference);
    assert.equal(mail[0].fromEmail, 'bob@example.com');
    assert.deepEqual(mail[0].context, { page: '/settings', browser: 'Chrome on Windows' }); // only the known keys

    console.error = realError;
    console.log('settings API selfcheck: all assertions passed');
  } catch (error) {
    console.error = realError;
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
