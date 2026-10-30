// The trip assistant API against a fake Prisma and a fake ai-features: auth,
// ownership of conversations, trip access, what the model is told, and that a
// failed answer saves nothing.
// node src/routes/chat.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

process.env.JWT_ACCESS_SECRET = 'selfcheck-secret';
process.env.superSecretKey = 'service-key';

const calls = [];
let foundTrip = null;
let foundConversation = null;
let stored = [];

const fakePrisma = {
  trip: { findFirst: async (args) => (calls.push(['trip.findFirst', args]), foundTrip) },
  chatConversation: {
    findFirst: async (args) => (calls.push(['chatConversation.findFirst', args]), foundConversation),
    create: async (args) => (calls.push(['chatConversation.create', args]), { id: 40, ...args.data }),
    update: async (args) => (calls.push(['chatConversation.update', args]), {}),
    deleteMany: async (args) => (calls.push(['chatConversation.deleteMany', args]), { count: args.where.id === 40 ? 1 : 0 }),
    findMany: async (args) => (calls.push(['chatConversation.findMany', args]), []),
  },
  chatMessage: {
    findMany: async () => stored,
    createMany: async (args) => (calls.push(['chatMessage.createMany', args]), {}),
  },
};
require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: fakePrisma };
// the advisory lookup is its own tested service; here it just answers
require.cache[path.join(__dirname, '../services/safetyService.js')] = {
  exports: { getCountrySafety: async () => ({ source: 'TRAVEL_RISK_API', lastUpdated: '2026-10-01', advisoryLevel: 2, summary: 'Exercise caution.' }) },
};

let aiAnswer = { ok: true, status: 200, body: { reply: 'Beach on day 2.' } };
let aiRequest = null;
global.fetch = ((realFetch) => async (url, init) => {
  if (!String(url).startsWith('https://richfield-it-project-tourist-app.vercel.app/chat')) return realFetch(url, init);
  aiRequest = { url: String(url), init, body: JSON.parse(init.body) };
  return { ok: aiAnswer.ok, status: aiAnswer.status, json: async () => aiAnswer.body };
})(global.fetch);

const { generateAccessToken } = require('../auth/tokenService');
const router = require('./chat');
const { buildContext } = require('../services/chatContext');

const trip = {
  id: 5,
  title: 'Durban week',
  description: '{"destination":"Durban","budget":900,"currency":"ZAR","travellers":2,"interests":["beach"],"email":"no@leak.test"}',
  status: 'PLANNING',
  startDate: new Date('2026-12-01'),
  endDate: new Date('2026-12-07'),
  itineraries: [{ id: 1, title: 'uShaka Marine World', location: 'Durban', dayNumber: 2, startTime: new Date('1970-01-01T09:00:00Z'), description: null }],
  destinations: [{ destination: { city: { country: { code: 'ZA', name: 'South Africa' } } } }],
};

// the context is plain facts, with the advisory and without stray fields
const context = buildContext(trip, { source: 'TRAVEL_RISK_API', lastUpdated: '2026-10-01', advisoryLevel: 2, summary: 'Exercise caution.' });
assert.match(context, /Trip: Durban week/);
assert.match(context, /Day 2 09:00: uShaka Marine World \(Durban\)/);
assert.match(context, /level 2\/4\. Exercise caution\./);
assert.ok(!context.includes('no@leak.test'));
assert.match(buildContext({ ...trip, itineraries: [] }, null), /no stops added yet[\s\S]*Safety advisory: not available/);

const app = express().use(express.json()).use('/api/chat', router);
const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${server.address().port}/api/chat`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${generateAccessToken({ id: 7, email: 'a@b.test' })}` };
  const call = async (p, init = {}) => {
    const r = await fetch(base + p, { headers, ...init });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };
  const ask = (body) => call('/', { method: 'POST', body: JSON.stringify(body) });
  const last = (name) => calls.filter(([n]) => n === name).at(-1)?.[1];

  try {
    // no token, no chat
    assert.equal((await fetch(base + '/conversations')).status, 401);

    // a new chat about a trip: the model gets the trip facts, the answer is saved
    foundTrip = trip;
    let r = await ask({ message: 'What is on day 2?', tripId: 5 });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { conversationId: 40, reply: 'Beach on day 2.' });
    assert.equal(aiRequest.init.headers['node-secretkey'], 'service-key');
    assert.match(aiRequest.body.context, /uShaka Marine World/);
    assert.deepEqual(aiRequest.body.messages, [{ role: 'user', content: 'What is on day 2?' }]);
    // the trip is looked up through the shared access rule, so a stranger gets a 404
    assert.equal(last('trip.findFirst').where.id, 5);
    assert.ok(last('trip.findFirst').where.OR);
    assert.deepEqual(last('chatMessage.createMany').data.map((m) => m.role), ['user', 'assistant']);

    // a trip the traveller cannot see
    foundTrip = null;
    r = await ask({ message: 'hi', tripId: 6 });
    assert.equal(r.status, 404);

    // someone else's conversation looks like no conversation
    foundConversation = null;
    r = await ask({ message: 'hi', conversationId: 41 });
    assert.equal(r.status, 404);
    assert.deepEqual(last('chatConversation.findFirst').where, { id: 41, userId: 7 });

    // continuing a chat sends its history and keeps its trip
    foundTrip = trip;
    foundConversation = { id: 40, userId: 7, tripId: 5 };
    stored = [{ role: 'assistant', content: 'a1' }, { role: 'user', content: 'q1' }]; // newest first, as the query orders them
    r = await ask({ message: 'and day 3?', conversationId: 40 });
    assert.equal(r.status, 200);
    assert.deepEqual(aiRequest.body.messages.map((m) => m.content), ['q1', 'a1', 'and day 3?']);

    // empty and oversize messages never reach the model
    aiRequest = null;
    assert.equal((await ask({ message: '   ' })).status, 400);
    assert.equal((await ask({ message: 'x'.repeat(2001) })).status, 400);
    assert.equal(aiRequest, null);

    // a failed answer saves nothing and does not leak provider text
    const saved = calls.filter(([n]) => n === 'chatMessage.createMany').length;
    aiAnswer = { ok: false, status: 502, body: { detail: 'The assistant is unavailable right now. Try again in a moment.' } };
    r = await ask({ message: 'hello' });
    assert.equal(r.status, 502);
    assert.match(r.body.message, /unavailable/);
    assert.equal(calls.filter(([n]) => n === 'chatMessage.createMany').length, saved);

    // delete only your own
    assert.equal((await call('/conversations/40', { method: 'DELETE' })).status, 204);
    assert.equal((await call('/conversations/41', { method: 'DELETE' })).status, 404);
    assert.deepEqual(last('chatConversation.deleteMany').where, { id: 41, userId: 7 });

    console.log('chat selfcheck: all assertions passed');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
