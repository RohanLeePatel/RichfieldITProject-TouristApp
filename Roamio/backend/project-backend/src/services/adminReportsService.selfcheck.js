// The admin audit log and the audience, notification, spending and safety reports,
// against a stand-in for Prisma that hands back fixed rows.
// node src/services/adminReportsService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const DAY = 86_400_000;
const now = Date.parse('2026-11-10T12:00:00Z');
const ago = (days) => new Date(now - days * DAY);

const written = [];
let failWrites = false;
const group = (rows) => async () => rows;
const dec = (n) => ({ toString: () => String(n), valueOf: () => n, [Symbol.toPrimitive]: () => n }); // like Prisma.Decimal

const prisma = {
  activityLog: {
    create: async ({ data }) => {
      if (failWrites) throw new Error('db down');
      written.push(data);
    },
    findMany: async () => [
      { id: 2, action: 'ADMIN_SUSPEND_USER', entityType: 'USER', entityId: 7, details: 'admin dashboard', createdAt: ago(1), user: { id: 1, fullName: 'Ada' } },
      { id: 1, action: 'ADMIN_DESTINATION_ADD', entityType: 'DESTINATION', entityId: null, details: 'Kyoto, Japan', createdAt: ago(2), user: { id: 1, fullName: 'Ada' } },
    ],
    count: async () => 2,
  },
  user: { findMany: async () => [{ id: 7, fullName: 'Bob' }] },
  loginEvent: {
    findMany: async () => [
      { userId: 1, deviceType: 'desktop', browser: 'Chrome', os: 'Windows' },
      { userId: 1, deviceType: 'desktop', browser: 'Chrome', os: 'Windows' }, // same person again: counted once
      { userId: 1, deviceType: 'mobile', browser: 'Safari', os: 'iOS' }, // same person, another device
      { userId: 2, deviceType: 'mobile', browser: '', os: 'Android' },
    ],
  },
  userPreference: {
    groupBy: async ({ by }) =>
      ({ language: [{ language: 'en', _count: { _all: 5 } }, { language: 'af', _count: { _all: 2 } }], currency: [{ currency: 'ZAR', _count: { _all: 6 } }], theme: [{ theme: 'dark', _count: { _all: 1 } }] })[by[0]],
    count: async ({ where } = {}) => (where?.emailAlerts ? 6 : where?.pushAlerts ? 3 : 8),
  },
  pushSubscription: { groupBy: group([{ userId: 1 }, { userId: 2 }]), count: async ({ where } = {}) => (where ? 1 : 3) },
  notification: {
    count: async ({ where }) => (where.createdAt.lt ? 10 : where.isRead ? 15 : 20),
    groupBy: group([{ type: 'INFO', _count: { _all: 5 } }, { type: 'ALERT', _count: { _all: 15 } }]),
  },
  expense: {
    groupBy: async ({ by }) =>
      by[0] === 'currency'
        ? [{ currency: 'EUR', _sum: { amount: dec(80) }, _count: { _all: 2 } }, { currency: 'ZAR', _sum: { amount: dec(1500.5) }, _count: { _all: 6 } }]
        : by[0] === 'category'
          ? [{ category: 'FOOD', _count: { _all: 6 } }, { category: 'TRANSPORT', _count: { _all: 2 } }]
          : [{ tripId: 1 }, { tripId: 2 }],
    count: async () => 5,
  },
  budget: { groupBy: group([{ currency: 'ZAR', _avg: { totalAmount: dec(12000.4) }, _count: { _all: 3 } }]) },
  expenseSplit: { count: async ({ where } = {}) => (where ? 3 : 4) },
  safetyAdvisory: {
    findMany: async () => [
      { countryIso: 'UKR', riskLevel: 4, advisoryLevel: 'Do not travel', lastUpdated: ago(1), source: 'MOCK', country: { name: 'Ukraine' } },
      { countryIso: 'FRA', riskLevel: 2, advisoryLevel: 'Increased caution', lastUpdated: ago(9), source: 'MOCK', country: { name: 'France' } },
    ],
  },
  country: { findMany: async () => [{ name: 'Peru' }] },
  safetyAlert: { groupBy: group([{ riskLevel: 3, _count: { _all: 1 } }, { riskLevel: 4, _count: { _all: 2 } }]) },
  tripDestination: {
    findMany: async () => [
      { trip: { id: 5, title: 'Kyiv', status: 'PLANNING', startDate: ago(-3) }, destination: { city: { country: { name: 'Ukraine', safetyAdvisory: { riskLevel: 4 } } } } },
      { trip: { id: 5, title: 'Kyiv', status: 'PLANNING', startDate: ago(-3) }, destination: { city: { country: { name: 'Poland', safetyAdvisory: { riskLevel: 3 } } } } },
    ],
  },
};
require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: prisma };

const audit = require('./adminAuditService');
const reports = require('./adminReportsService');

(async () => {
  // audit log: writes carry the admin, never throw, and reads name both people
  await audit.log(1, 'ADMIN_SUSPEND_USER', { entityType: 'USER', entityId: 7 });
  assert.deepEqual(written[0], { userId: 1, action: 'ADMIN_SUSPEND_USER', entityType: 'USER', entityId: 7, details: 'admin dashboard' });
  failWrites = true;
  await audit.log(1, 'ADMIN_SUSPEND_USER'); // must not throw
  const list = await audit.list({ page: '1' });
  assert.equal(list.total, 2);
  assert.deepEqual(list.entries[0].admin, { id: 1, name: 'Ada' });
  assert.deepEqual(list.entries[0].target, { type: 'USER', id: 7, name: 'Bob' });
  assert.equal(list.entries[1].target.name, null, 'a destination has no person to name');

  // audience: a person counts once per bucket, and a blank browser is "Unknown"
  const a = await reports.audience({ days: 30, now });
  assert.equal(a.activeUsers, 2);
  assert.deepEqual(a.devices, [{ label: 'desktop', count: 1 }, { label: 'mobile', count: 2 }].sort((x, y) => y.count - x.count));
  assert.deepEqual(a.browsers.find((b) => b.label === 'Unknown'), { label: 'Unknown', count: 1 });
  assert.deepEqual(a.languages, [{ label: 'en', count: 5 }, { label: 'af', count: 2 }]);
  assert.equal((await reports.audience({ days: 'x', now })).days, 30);

  // notifications and push
  const e = await reports.engagement({ days: 30, now });
  assert.deepEqual(e.push, { users: 2, devices: 3, failingDevices: 1 });
  assert.deepEqual([e.preferences.emailRate, e.preferences.pushRate], [75, 38]);
  assert.deepEqual([e.notifications.sent, e.notifications.previous, e.notifications.readRate], [20, 10, 75]);
  assert.equal(e.notifications.byType[0].label, 'ALERT');

  // spending: money stays in its own currency, never summed across them
  const s = await reports.spending({ days: 30, now });
  assert.equal(s.expenses.count, 8);
  assert.equal(s.expenses.perTrip, 4);
  assert.deepEqual(s.totals.map((t) => [t.currency, t.total, t.count]), [['ZAR', 1500.5, 6], ['EUR', 80, 2]]);
  assert.deepEqual(s.categories[0], { label: 'FOOD', count: 6, share: 75 });
  assert.deepEqual(s.budgets, [{ currency: 'ZAR', average: 12000, count: 3 }]);
  assert.deepEqual(s.settlement, { total: 4, settled: 3, rate: 75 });

  // safety: stale and missing advisories, and one row per at-risk trip at its worst level
  const f = await reports.safety({ now });
  assert.deepEqual(f.advisories.map((x) => [x.country, x.stale]), [['Ukraine', false], ['France', true]]);
  assert.deepEqual(f.missing, ['Peru']);
  assert.deepEqual(f.openAlerts, [{ riskLevel: 4, count: 2 }, { riskLevel: 3, count: 1 }]);
  assert.equal(f.tripsAtRisk.length, 1);
  assert.deepEqual([f.tripsAtRisk[0].country, f.tripsAtRisk[0].riskLevel], ['Ukraine', 4]);
  assert.equal(f.usingMockData, true);

  console.log('admin reports selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
