// The admin dashboard's own-data analytics, user management and catalogue helpers,
// against a stand-in for Prisma that hands back fixed rows.
// node src/services/adminInsightsService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.ADMIN_USER_IDS = '1';
process.env.superSecretKey = 'service-key';

const DAY = 86_400_000;
const now = Date.parse('2026-11-10T12:00:00Z');
const ago = (days) => new Date(now - days * DAY);

const audits = [];
const revoked = [];
const users = new Map([
  [1, { id: 1, isActive: true }],
  [2, { id: 2, isActive: true }],
]);

// current-period rows are within 30 days, previous-period rows are 31-60 days back
const prisma = {
  user: {
    findMany: async (args) => {
      if (args.select?.fullName) {
        // CSV export: one page, with a hostile name
        return [{ id: 2, fullName: '=HYPERLINK("x")', email: 'a@b.co', isActive: false, isVerified: true, createdAt: ago(3), loginEvents: [] }];
      }
      return [
        { id: 10, createdAt: ago(1) },
        { id: 11, createdAt: ago(1) },
        { id: 12, createdAt: ago(5) },
        { id: 13, createdAt: ago(40) }, // previous period
      ];
    },
    count: async ({ where }) => {
      if (where.sentInvitations) return 1;
      if (where.tripMemberships?.some?.trip) return 2;
      if (where.tripMemberships) return 2;
      if (where.isVerified) return 3;
      return 99; // total users
    },
    findFirst: async ({ where }) => users.get(where.id) ?? null,
    update: async ({ where, data }) => Object.assign(users.get(where.id), data),
  },
  loginEvent: {
    findMany: async ({ where }) =>
      where.userId
        ? [
            { userId: 10, at: ago(1) }, // same day as signup: not a return
            { userId: 11, at: ago(0) }, // a day later: returned
          ]
        : [
            { userId: 10, at: ago(1) },
            { userId: 10, at: ago(1) },
            { userId: 11, at: ago(0) },
            { userId: 12, at: ago(45) }, // previous period
          ],
  },
  trip: { findMany: async () => [{ createdAt: ago(2) }, { createdAt: ago(2) }, { createdAt: ago(50) }], count: async ({ where }) => (where.createdAt.lt ? 2 : 5) },
  tripDestination: {
    groupBy: async ({ where }) =>
      where.createdAt?.lt ? [{ destinationId: 1, _count: { _all: 1 } }] : [{ destinationId: 1, _count: { _all: 4 } }, { destinationId: 2, _count: { _all: 2 } }],
  },
  destination: {
    findMany: async () => [
      { id: 1, name: 'Eiffel Tower', city: { id: 1, name: 'Paris', country: { id: 1, name: 'France' } } },
      { id: 2, name: 'Louvre', city: { id: 1, name: 'Paris', country: { id: 1, name: 'France' } } },
    ],
  },
  userSession: {
    updateMany: async ({ where }) => revoked.push(where.userId),
    count: async () => 2,
  },
  activityLog: { create: async ({ data }) => audits.push(data) },
  travelGroup: { count: async () => 4 },
  travelGroupMember: { count: async () => 10 },
  catalogDestination: {
    findMany: async () => [
      { id: 'france-paris', name: 'Paris', country: 'France', imageUrl: null, enrichedAt: ago(1), enrichError: null, active: true },
      { id: 'japan-kyoto', name: 'Kyoto', country: 'Japan', imageUrl: 'https://x/y.jpg', enrichedAt: ago(400), enrichError: 'boom', active: true },
      { id: 'peru-lima', name: 'Lima', country: 'Peru', imageUrl: 'https://x/y.jpg', enrichedAt: null, enrichError: null, active: false },
      { id: 'italy-rome', name: 'Rome', country: 'Italy', imageUrl: 'https://x/y.jpg', enrichedAt: ago(1), enrichError: null, active: true },
    ],
    updateMany: async ({ where }) => ({ count: where.id.in.length }),
  },
  invitation: { count: async ({ where }) => (where.status ? 3 : 6) },
};
for (const model of ['itineraryItem', 'expense', 'tripDocument', 'chatMessage', 'translation_history']) {
  prisma[model] = { count: async ({ where }) => (Object.values(where).some((v) => v?.lt) ? 1 : 7) };
}
require.cache[path.join(__dirname, '../config/prisma.js')] = { exports: prisma };

const { getInsights } = require('./adminInsightsService');
const userService = require('./adminUserService');
const catalog = require('./catalogService');

const fails = async (promise, status, pattern) => {
  const error = await promise.then(() => null, (e) => e);
  assert.ok(error, 'expected a rejection');
  assert.equal(error.statusCode, status);
  if (pattern) assert.match(error.message, pattern);
};

(async () => {
  const data = await getInsights({ days: 30, now });
  assert.equal(data.days, 30);
  assert.equal((await getInsights({ days: 'x', now })).days, 30, 'bad range falls back to 30');
  assert.equal((await getInsights({ days: 7, now })).days, 7);

  // KPIs: this period vs. the one before, one point per day
  const { kpis } = data;
  assert.equal(kpis.totalUsers.value, 99);
  assert.deepEqual([kpis.newUsers.value, kpis.newUsers.previous], [3, 1]);
  assert.deepEqual([kpis.activeUsers.value, kpis.activeUsers.previous], [2, 1], 'distinct people, not sign-ins');
  assert.deepEqual([kpis.trips.value, kpis.trips.previous], [2, 1]);
  assert.equal(kpis.newUsers.series.length, 30);
  assert.equal(kpis.newUsers.series.at(-1).date, '2026-11-10');
  assert.equal(kpis.newUsers.series.find((p) => p.date === '2026-11-09').value, 2);
  assert.equal(kpis.activeUsers.series.find((p) => p.date === '2026-11-09').value, 1, 'two sign-ins by one person is one active user');

  // where people are going
  const { places, cities, countries } = data.topDestinations;
  assert.deepEqual(places.map((p) => [p.label, p.count, p.previous]), [['Eiffel Tower', 4, 1], ['Louvre', 2, 0]]);
  assert.deepEqual(cities.map((c) => [c.label, c.sub, c.count, c.previous]), [['Paris', 'France', 6, 1]]);
  assert.deepEqual(countries.map((c) => [c.label, c.count]), [['France', 6]]);

  // funnel never grows as it goes down; retention only counts a return on a later day
  assert.deepEqual(data.funnel.map((f) => f.count), [3, 3, 2, 2, 1]);
  assert.deepEqual(data.retention, { newUsers: 3, returned: 1, rate: 33 });

  assert.deepEqual(data.features.find((f) => f.key === 'chat'), { key: 'chat', label: 'Assistant questions', count: 7, previous: 1 });
  assert.deepEqual(data.collaboration, { groups: 4, invitesSent: 6, invitesAccepted: 3, acceptRate: 50, avgGroupSize: 2.5 });

  // CSV cells that a spreadsheet would run as a formula are neutralised
  assert.equal(userService.csvCell('=1+1'), "'=1+1");
  assert.equal(userService.csvCell('a,"b"'), '"a,""b"""');
  assert.equal(userService.csvCell(null), '');
  const csv = await userService.exportCsv();
  assert.match(csv, /^id,name,email,status,joined,last_login\r\n2,"'=HYPERLINK\(""x""\)",a@b\.co,suspended,/);

  // suspending: not yourself, not an admin, not a stranger; signs the user out and is logged
  await fails(userService.setActive(1, '1', false), 400, /own account/);
  await fails(userService.setActive(5, '1', false), 400, /administrator/);
  await fails(userService.setActive(1, '2', 'no'), 400, /true or false/);
  await fails(userService.setActive(1, '77', false), 404);
  await fails(userService.setActive(1, 'abc', false), 400, /Invalid user id/);
  assert.deepEqual(await userService.setActive(1, '2', false), { id: 2, isActive: false });
  assert.equal(users.get(2).isActive, false);
  assert.deepEqual(revoked, [2]);
  assert.deepEqual(audits.at(-1), { userId: 1, action: 'ADMIN_SUSPEND_USER', entityType: 'USER', entityId: 2, details: 'admin dashboard' });
  await userService.setActive(1, '2', true);
  assert.equal(users.get(2).isActive, true);
  assert.deepEqual(revoked, [2], 'reactivating does not sign anyone out');
  assert.equal(audits.at(-1).action, 'ADMIN_REACTIVATE_USER');

  // catalogue: what needs fixing, how many trips use each city, bulk show/hide
  const list = await catalog.listAll(new Date(now));
  assert.deepEqual(Object.fromEntries(list.map((d) => [d.id, d.issues])), {
    'france-paris': ['no_photo'],
    'japan-kyoto': ['old_data', 'fetch_failed'],
    'peru-lima': ['no_data'],
    'italy-rome': [],
  });
  assert.deepEqual(await catalog.tripCounts(), { 'france-paris': 6 });
  assert.deepEqual(await catalog.setActiveMany(['a', 'b'], false), { updated: 2 });
  await fails(catalog.setActiveMany([], true), 400);
  await fails(catalog.setActiveMany([1], true), 400);
  await fails(catalog.setActiveMany(['a'], 'yes'), 400);

  console.log('admin insights selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
