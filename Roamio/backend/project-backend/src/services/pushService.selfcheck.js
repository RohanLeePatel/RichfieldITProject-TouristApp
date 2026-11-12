// Preference gating, dedupe and dead-subscription cleanup in notifyUser, against
// in-memory stand-ins for Prisma and web-push.
// node src/services/pushService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.VAPID_PUBLIC_KEY = 'pub';
process.env.VAPID_PRIVATE_KEY = 'priv';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

let prefs = null;
let subs = [];
const inbox = [];
const sent = [];
let failWith = null;

require.cache[require.resolve('web-push')] = {
  exports: {
    setVapidDetails: () => {},
    sendNotification: async (sub, payload, options) => {
      const statusCode = typeof failWith === 'function' ? failWith(sub) : failWith;
      if (statusCode) throw Object.assign(new Error('push failed'), { statusCode });
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), options });
    },
  },
};
require.cache[path.join(__dirname, '../config/prisma.js')] = {
  exports: {
    notification: {
      create: async ({ data }) => {
        if (data.dedupeKey && inbox.some((n) => n.userId === data.userId && n.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        inbox.push(data);
      },
    },
    notificationPreference: { findUnique: async () => (prefs ? { prefs } : null) },
    pushSubscription: {
      findMany: async () => subs,
      findFirst: async ({ where }) => subs.find((s) => s.userId === where.userId && s.endpoint === where.endpoint),
      update: async ({ where, data }) => {
        const row = subs.find((s) => s.id === where.id);
        if (data.failureCount?.increment) row.failureCount += data.failureCount.increment;
        else Object.assign(row, data);
      },
      deleteMany: async ({ where }) => { subs = subs.filter((s) => s.id !== where.id); },
    },
  },
};

const { notifyUser, sendTestPush, safePath } = require('./pushService');
const alert = { type: 'ALERT', topic: 'safetyAlerts', title: 'Safety alert', body: 'Level 3', url: '/trips/4' };
const reset = () => { inbox.length = 0; sent.length = 0; failWith = null; subs = [{ id: 1, userId: 1, endpoint: 'e1', p256dh: 'p', auth: 'a', failureCount: 0 }]; };

(async () => {
  assert.equal(safePath('/trips/4'), '/trips/4');
  assert.equal(safePath('//evil.com'), '/');
  assert.equal(safePath('https://evil.com'), '/');
  assert.equal(safePath(undefined), '/');

  // no preference row: the browser channel was never switched on, so inbox only
  reset(); prefs = null;
  assert.equal((await notifyUser(1, alert)).pushed, 0);
  assert.equal(inbox.length, 1);
  assert.equal(sent.length, 0);

  // channel on, topic unmuted by default: pushed
  reset(); prefs = { channels: { browser: true }, topics: {} };
  assert.equal((await notifyUser(1, alert)).pushed, 1);
  assert.deepEqual(sent[0].payload, { title: 'Safety alert', body: 'Level 3', url: '/trips/4' });

  // topic muted: inbox only
  reset(); prefs = { channels: { browser: true }, topics: { safetyAlerts: { browser: false } } };
  assert.equal((await notifyUser(1, alert)).pushed, 0);
  assert.equal(inbox.length, 1);

  // channel off: inbox only
  reset(); prefs = { channels: { browser: false }, topics: {} };
  assert.equal((await notifyUser(1, alert)).pushed, 0);

  // the same dedupeKey twice: one inbox row, one push
  reset(); prefs = { channels: { browser: true }, topics: {} };
  await notifyUser(1, { ...alert, dedupeKey: 'k' });
  assert.equal((await notifyUser(1, { ...alert, dedupeKey: 'k' })).duplicate, true);
  assert.equal(inbox.length, 1);
  assert.equal(sent.length, 1);

  // an unsubscribed browser (410) is dropped at once
  reset(); failWith = 410;
  assert.equal((await notifyUser(1, alert)).pushed, 0);
  assert.equal(subs.length, 0);

  // Regular notifications still fan out when one browser has unsubscribed.
  reset(); failWith = (sub) => sub.endpoint === 'e1' ? 410 : null;
  subs.push({ ...subs[0], id: 2, endpoint: 'e2' });
  assert.equal((await notifyUser(1, alert)).pushed, 1);
  assert.deepEqual(sent.map((entry) => entry.endpoint), ['e2']);
  assert.deepEqual(subs.map((sub) => sub.endpoint), ['e2']);

  // other failures count up, and the subscription goes at five
  reset(); failWith = 500;
  for (let i = 0; i < 4; i += 1) await notifyUser(1, alert);
  assert.equal(subs[0].failureCount, 4);
  await notifyUser(1, alert);
  assert.equal(subs.length, 0);

  reset(); prefs = null;
  subs.push({ ...subs[0], id: 2, endpoint: 'e2' });
  assert.equal(await sendTestPush(2, 'e1'), null);
  assert.equal(sent.length, 0);
  assert.equal(await sendTestPush(1, 'e2'), true);
  assert.deepEqual(sent.map((message) => message.endpoint), ['e2']);
  assert.deepEqual(sent[0].options, { urgency: 'high', TTL: 30, timeout: 5000 });
  assert.equal(inbox.length, 0);
  failWith = 410;
  assert.equal(await sendTestPush(1, 'e2'), false);
  assert.deepEqual(subs.map((sub) => sub.endpoint), ['e1']);

  console.log('pushService selfcheck passed');
})();
