// How a sign-in is described (browser, system, device, place) and how sessions
// start and renew, against an in-memory stand-in for Prisma.
// node src/services/sessionService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const day = 24 * 60 * 60 * 1000;
const sessions = [];
const events = [];
const deletes = [];
const alerts = [];
const emails = [];
require.cache[path.join(__dirname, 'emailService.js')] = { exports: { sendNewSignInEmail: async (to, info) => emails.push({ to, ...info }) } };
const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
require.cache[path.join(__dirname, 'pushService.js')] = { exports: { notifyUser: async (userId, args) => alerts.push({ userId, ...args }) } };
require.cache[path.join(__dirname, '../config/prisma.js')] = {
  exports: {
    user: { findUnique: async ({ where }) => ({ email: `user${where.id}@example.com` }) },
    userSession: {
      create: async ({ data }) => sessions.push({ revokedAt: null, lastSeenAt: new Date(), ...data }),
      updateMany: async ({ where, data }) => {
        const rows = sessions.filter(
          (s) => s.id === where.id && s.userId === where.userId && s.revokedAt === where.revokedAt && s.lastSeenAt >= where.lastSeenAt.gte
        );
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    loginEvent: {
      create: async ({ data }) => events.push(data),
      deleteMany: async ({ where }) => deletes.push(where),
      findFirst: async ({ where }) => events.find((e) => matches(e, where)) || null,
      count: async ({ where }) => events.filter((e) => matches(e, where)).length,
    },
  },
};

const { parseAgent, clientInfo } = require('../utils/clientInfo');
const sessionService = require('./sessionService');

(async () => {
  // the browser, system and kind of device, from the user agent
  const agents = {
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36': ['Chrome', 'Windows', 'desktop'],
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0': ['Edge', 'Windows', 'desktop'],
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15': ['Safari', 'macOS', 'desktop'],
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1': ['Safari', 'iOS', 'mobile'],
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1': ['Safari', 'iOS', 'tablet'],
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36': ['Chrome', 'Android', 'mobile'],
    'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36': ['Chrome', 'Android', 'tablet'],
    'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0': ['Firefox', 'Linux', 'desktop'],
  };
  for (const [agent, [browser, os, deviceType]] of Object.entries(agents)) assert.deepEqual(parseAgent(agent), { browser, os, deviceType }, agent);
  assert.deepEqual(parseAgent(undefined), { browser: 'Unknown browser', os: 'Unknown system', deviceType: 'desktop' });

  // address and place: the proxy's view of the visitor, and Vercel's location headers
  const info = clientInfo({ ip: '::ffff:102.65.12.4', headers: { 'user-agent': 'x', 'x-vercel-ip-country': 'ZA', 'x-vercel-ip-city': 'Port%20Elizabeth' } });
  assert.equal(info.ipAddress, '102.65.12.4');
  assert.equal(info.location, 'Port Elizabeth, South Africa');
  assert.equal(clientInfo({ ip: '1.1.1.1', headers: { 'x-vercel-ip-country': 'ZA' } }).location, 'South Africa');
  assert.equal(clientInfo({ ip: '1.1.1.1', headers: {} }).location, ''); // local development: nothing to show
  assert.equal(clientInfo({ ip: '1.1.1.1', headers: { 'x-vercel-ip-country': '<script>' } }).location, '');
  assert.equal(clientInfo(undefined).ipAddress, '');

  // a sign-in opens a session and is logged, and old history is cleared out
  const req = { ip: '10.0.0.1', headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0' } };
  const id = await sessionService.start(7, req);
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.deepEqual([sessions[0].userId, sessions[0].browser, sessions[0].ipAddress], [7, 'Firefox', '10.0.0.1']);
  assert.deepEqual([events[0].userId, events[0].success, events[0].os], [7, true, 'Linux']);
  assert.equal(deletes[0].userId, 7);
  assert.ok(deletes[0].at.lt < new Date(Date.now() - 80 * day)); // 90 days of history are kept
  // a renewal of an old token opens a session without adding to the history
  await sessionService.start(7, req, { record: false });
  assert.equal(sessions.length, 2);
  assert.equal(events.length, 1);

  assert.equal(alerts.length + emails.length, 0); // the first sign-in has nothing to compare with

  // the same device again: quiet. A different browser on a known account: alerts, to that user
  await sessionService.start(7, req);
  assert.equal(alerts.length, 0);
  const chrome = { ip: '10.0.0.2', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', 'x-vercel-ip-country': 'ZA' } };
  const chromeId = await sessionService.start(7, chrome);
  assert.equal(alerts.length, 1);
  assert.deepEqual([alerts[0].userId, alerts[0].topic, alerts[0].dedupeKey], [7, 'securityAlerts', `signin:${chromeId}`]);
  assert.deepEqual([emails.length, emails[0].to, emails[0].browser, emails[0].ipAddress], [1, 'user7@example.com', 'Chrome', '10.0.0.2']);
  assert.match(alerts[0].body, /^Chrome on Windows in South Africa\./);
  // another traveller's first sign-in, and a renewal, never alert
  await sessionService.start(8, chrome);
  await sessionService.start(7, { headers: {} }, { record: false });
  assert.equal(alerts.length, 1);
  assert.equal(emails.length, 1);
  events.length = 1; // back to one event for the checks below
  sessions.length = 2;

  await sessionService.recordFailure(7, req);
  assert.deepEqual([events[1].userId, events[1].success], [7, false]);

  // renewing: fine while it is open (and it counts as use)...
  sessions[0].lastSeenAt = new Date(Date.now() - 3 * day);
  const before = sessions[0].lastSeenAt;
  assert.equal(await sessionService.touch(id, 7), true);
  assert.ok(sessions[0].lastSeenAt > before);
  // ...not for another traveller, not once signed out, not after a week unused
  assert.equal(await sessionService.touch(id, 8), false);
  assert.equal(await sessionService.touch('nope', 7), false);
  sessions[0].lastSeenAt = new Date(Date.now() - 8 * day);
  assert.equal(await sessionService.touch(id, 7), false);
  sessions[0].lastSeenAt = new Date();
  assert.equal(await sessionService.revoke(7, id), true);
  assert.equal(await sessionService.touch(id, 7), false);

  console.log('session service selfcheck: all assertions passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
