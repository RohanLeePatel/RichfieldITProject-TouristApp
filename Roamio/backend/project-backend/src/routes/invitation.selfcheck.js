// Invite links over HTTP against an in-memory invitation store: each state the
// invite page shows has its own code (INVALID, EXPIRED, USED, ALREADY_ACCEPTED,
// WRONG_ACCOUNT), a spent link never says who used it, and the public preview
// only recognises a signed-in visitor when a valid token is sent.
// node src/routes/invitation.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

process.env.JWT_ACCESS_SECRET = 'selfcheck-secret';

const DAY = 24 * 60 * 60 * 1000;
const users = { 1: { id: 1, email: 'owner@x.io', fullName: 'Owner' }, 2: { id: 2, email: 'guest@x.io', fullName: 'Guest' }, 3: { id: 3, email: 'other@x.io', fullName: 'Other' } };
const members = new Set(['10:1']); // `${groupId}:${userId}`
const groupTrips = { 10: [55] };
const group = { id: 10, name: 'Lima group', deletedAt: null };
const invites = {};
const invite = (token, extra = {}) => {
  invites[token] = { id: Object.keys(invites).length + 1, token, travelGroupId: 10, travelGroup: group, inviter: { fullName: 'Owner' }, email: 'guest@x.io', role: 'MEMBER', status: 'PENDING', expiresAt: new Date(Date.now() + DAY), ...extra };
};

const fakeRepo = {
  findInvitationByToken: async (token) => invites[token] || null,
  findUserById: async (id) => users[id],
  checkGroupMembership: async (groupId, userId) => (members.has(`${groupId}:${userId}`) ? { role: 'MEMBER' } : null),
  findGroupTripIds: async (groupId) => groupTrips[groupId] || [],
  updateInvitationStatus: async (id, status) => {
    Object.values(invites).find((row) => row.id === id).status = status;
  },
  acceptInvitation: async (invitation, userId) => {
    const row = invites[invitation.token];
    if (row.status !== 'PENDING') return null;
    row.status = 'ACCEPTED';
    row.acceptedBy = userId; // stored, but must never reach a response
    members.add(`${invitation.travelGroupId}:${userId}`);
    return { role: invitation.role };
  },
};
require.cache[path.join(__dirname, '../repositories/invitationRepository.js')] = { exports: fakeRepo };
require.cache[path.join(__dirname, '../services/groupActivityService.js')] = { exports: { notifyInvite: async () => 0 } };

const { generateAccessToken } = require('../auth/tokenService');
const router = require('./invitation');

const app = express().use(express.json()).use('/api', router);
const as = (id) => ({ authorization: `Bearer ${generateAccessToken({ id, email: users[id].email })}` });

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = (p, headers = {}, body) =>
    fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...headers }, body: body && JSON.stringify(body) })
      .then(async (r) => ({ status: r.status, body: await r.json() }));
  const preview = (token, headers) => call(`/invites/${token}`, headers);
  const accept = (token, userId) => call('/invites/accept', as(userId), { token });

  try {
    // invalid: unknown token, anonymous or signed in, preview or accept
    assert.equal((await preview('nope')).body.code, 'INVALID');
    assert.equal((await preview('nope')).status, 404);
    assert.equal((await accept('nope', 2)).body.code, 'INVALID');

    // a pending invite previews for anyone; a bad token is just ignored (no 401)
    invite('fresh');
    let r = await preview('fresh', { authorization: 'Bearer garbage' });
    assert.equal(r.status, 200);
    assert.equal(r.body.groupName, 'Lima group');

    // a different account can't take a pending invite
    r = await accept('fresh', 3);
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'WRONG_ACCOUNT');

    // the invited account joins; with one trip in the group it's told which
    r = await accept('fresh', 2);
    assert.equal(r.status, 200);
    assert.equal(r.body.tripId, 55);
    assert.equal(r.body.groupId, 10);

    // the same link again, by the account that used it: already accepted, with where to go
    for (const res of [await accept('fresh', 2), await preview('fresh', as(2))]) {
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'ALREADY_ACCEPTED');
      assert.equal(res.body.error, "You've already accepted this invite.");
      assert.equal(res.body.tripId, 55);
    }

    // ...by an account without access, or anonymously: spent - not "different email",
    // and nothing about who used it
    for (const res of [await accept('fresh', 3), await preview('fresh', as(3)), await preview('fresh')]) {
      assert.equal(res.status, 410);
      assert.equal(res.body.code, 'USED');
      assert.match(res.body.error, /new invite/);
      const text = JSON.stringify(res.body);
      for (const leak of ['guest', 'Guest', '"acceptedBy"', '"email"']) assert.ok(!text.includes(leak), `leaked ${leak}: ${text}`);
    }

    // expired: by date (marked EXPIRED on first accept attempt) and by status
    invite('old', { expiresAt: new Date(Date.now() - DAY) });
    assert.equal((await preview('old')).body.code, 'EXPIRED');
    r = await accept('old', 2);
    assert.equal(r.status, 410);
    assert.equal(r.body.code, 'EXPIRED');
    assert.equal(invites.old.status, 'EXPIRED');
    assert.equal((await accept('old', 3)).body.code, 'EXPIRED');

    // a pending invite for someone who's already in the group (e.g. joined by link)
    invite('dup', { email: 'owner@x.io' });
    r = await accept('dup', 1);
    assert.equal(r.body.code, 'ALREADY_ACCEPTED');
    assert.equal(invites.dup.status, 'PENDING');

    // accepting still needs sign-in
    assert.equal((await call('/invites/accept', {}, { token: 'dup' })).status, 401);

    console.log('invitation selfcheck: all assertions passed');
  } finally {
    server.close();
  }
});
