process.env.AI_FEATURES_URL = 'https://richfield-it-project-tourist-app.vercel.app'; // the stubs below match this host
// The destination catalog: input checks, ids, adding a city and filling in its
// data through the AI service, which cities are offered, and the weekly refresh,
// against an in-memory stand-in for Prisma and a stubbed fetch.
// node src/services/catalogService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.superSecretKey = 'service-key';
const rows = new Map();
let lastWhere;
require.cache[path.join(__dirname, '../config/prisma.js')] = {
  exports: {
    catalogDestination: {
      // honours only the two filters the service uses for the offered list
      findMany: async ({ where } = {}) => {
        lastWhere = where;
        return [...rows.values()].filter(
          (r) => (where?.active === undefined || r.active === where.active) && (where?.enrichedAt?.not !== null || r.enrichedAt),
        );
      },
      findUnique: async ({ where }) => rows.get(where.id) || null,
      create: async ({ data }) => rows.set(data.id, { enrichedAt: null, enrichError: null, features: null, ...data }).get(data.id),
      update: async ({ where, data }) => rows.set(where.id, { ...rows.get(where.id), ...data }).get(where.id),
      delete: async ({ where }) => rows.delete(where.id),
    },
  },
};

const service = require('./catalogService');

const FEATURES = { interest_counts: { history: 5 }, accessibility: 'supported', accessible_ratio: 0.9, tagged_total: 12, avg_temp_by_month: { 1: 4 }, avg_rain_mm_by_month: { 1: 50 } };
const calls = [];
let reply = () => ({ ok: true, status: 200, json: async () => ({ ...FEATURES, image_url: 'https://img.example/kyoto.jpg' }) });
global.fetch = async (url, init) => {
  calls.push({ url, init });
  return reply();
};
const fails = async (promise, status, pattern) => {
  const error = await promise.then(() => null, (e) => e);
  assert.ok(error, 'expected a rejection');
  assert.equal(error.statusCode, status);
  if (pattern) assert.match(error.message, pattern);
};

(async () => {
  // ids: the same country slug the AI service uses, accents dropped
  assert.equal(service.countrySlug('United Arab Emirates'), 'united-arab-emirates');
  assert.equal(service.makeId('Switzerland', 'Zürich'), 'switzerland-zurich');

  // input checks
  const ok = { name: ' Kyoto ', country: 'Japan', lat: '35.01', lon: 135.77 };
  assert.deepEqual(service.validate(ok), { name: 'Kyoto', country: 'Japan', lat: 35.01, lon: 135.77, radiusM: 12000, costIndex: 3, active: true, imageUrl: null });
  assert.deepEqual(service.validate({ costIndex: 5 }, { partial: true }), { costIndex: 5 });
  const invalid = [{ name: '' }, { lat: 91 }, { lon: 'x' }, { radiusM: 10 }, { radiusM: 5000.5 }, { costIndex: 6 }, { costIndex: 0 }, { imageUrl: 'http://a.test/x.jpg' }, { imageUrl: 'javascript:alert(1)' }, { active: 'yes' }];
  for (const bad of invalid) {
    assert.throws(() => service.validate({ ...ok, ...bad }), (e) => e.statusCode === 400, JSON.stringify(bad));
  }
  assert.throws(() => service.validate({ name: 'Kyoto' }), /Country is required/);

  // adding a city fetches its data from the AI service with the service key
  const added = await service.create(ok);
  assert.equal(added.enrichError, null);
  assert.equal(added.destination.id, 'japan-kyoto');
  assert.equal(added.destination.stale, false);
  assert.equal(added.destination.imageUrl, 'https://img.example/kyoto.jpg');
  assert.equal(calls[0].url, 'https://richfield-it-project-tourist-app.vercel.app/v1/destinations/enrich');
  assert.equal(calls[0].init.headers['node-secretkey'], 'service-key');
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: 'Kyoto', country: 'Japan', lat: 35.01, lon: 135.77, radius_m: 12000 });
  assert.deepEqual(rows.get('japan-kyoto').features, FEATURES); // the photo is a column, not part of features
  await fails(service.create(ok), 409, /already in the list/);
  await fails(service.create({ ...ok, name: '京都', country: '日本' }), 400, /English letters/);

  // without coordinates the city is looked up by name first; a place nobody can find is a 404 and adds nothing
  reply = () => ({ ok: true, status: 200, json: async () => ({ lat: 34.99, lon: 135.76 }) });
  const before = calls.length;
  const nameOnly = await service.create({ name: 'Nara', country: 'Japan' });
  assert.match(calls[before].url, /\/destinations\/geocode$/);
  assert.deepEqual(JSON.parse(calls[before].init.body), { name: 'Nara', country: 'Japan' });
  assert.equal(rows.get('japan-nara').lat, 34.99);
  assert.equal(nameOnly.destination.id, 'japan-nara');
  reply = () => ({ ok: false, status: 404, json: async () => ({ detail: 'Could not find Atlantis, Nowhere on the map.' }) });
  await fails(service.create({ name: 'Atlantis', country: 'Nowhere' }), 404, /Could not find/);
  assert.equal(rows.has('nowhere-atlantis'), false);
  rows.delete('japan-nara');

  // a failed fetch keeps the city and says why
  reply = () => ({ ok: false, status: 502, json: async () => ({ detail: 'A data provider did not answer (HTTPError).' }) });
  const partial = await service.create({ name: 'Osaka', country: 'Japan', lat: 34.69, lon: 135.5, imageUrl: 'https://img.example/mine.jpg' });
  assert.match(partial.enrichError, /did not answer/);
  assert.equal(partial.destination.enrichedAt, null);
  assert.equal(partial.destination.stale, true);
  assert.match(rows.get('japan-osaka').enrichError, /did not answer/);

  // retrying works, and keeps a photo an administrator chose
  reply = () => ({ ok: true, status: 200, json: async () => ({ ...FEATURES, image_url: 'https://img.example/other.jpg' }) });
  const retried = await service.enrich('japan-osaka');
  assert.equal(retried.imageUrl, 'https://img.example/mine.jpg');
  assert.equal(rows.get('japan-osaka').enrichError, null);

  // a network failure is a 502 with a plain message, stored for the list
  global.fetch = async () => {
    throw new Error('connect ECONNREFUSED 10.0.0.1');
  };
  await fails(service.enrich('japan-osaka'), 502, /did not answer in time/);
  assert.doesNotMatch(rows.get('japan-osaka').enrichError, /10\.0\.0\.1/);
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return reply();
  };

  // unknown ids
  await fails(service.enrich('nowhere'), 404);
  await fails(service.update('nowhere', { active: false }), 404);
  await fails(service.remove('nowhere'), 404);

  // editing
  await fails(service.update('japan-kyoto', {}), 400, /Nothing to change/);
  assert.equal((await service.update('japan-kyoto', { costIndex: 4 })).costIndex, 4);

  // only active, enriched cities are offered, in the AI service's field names
  await service.update('japan-osaka', { active: false });
  rows.set('x-new', { id: 'x-new', name: 'New', country: 'X', costIndex: 3, active: true, enrichedAt: null, features: null });
  const catalog = await service.loadCatalog();
  assert.deepEqual(catalog.map((c) => c.id), ['japan-kyoto']);
  assert.deepEqual(catalog[0], { id: 'japan-kyoto', name: 'Kyoto', country: 'Japan', image_url: 'https://img.example/kyoto.jpg', cost_index: 4, ...FEATURES });
  assert.deepEqual(service.countriesOf([{ country: 'Japan' }, { country: 'Japan' }, { country: 'Iceland' }]),
    [{ id: 'iceland', name: 'Iceland', city_count: 1 }, { id: 'japan', name: 'Japan', city_count: 2 }]);

  // the admin list shows everything, with staleness
  rows.get('japan-kyoto').enrichedAt = new Date('2025-01-01');
  const list = await service.listAll(new Date('2026-11-05'));
  assert.equal(list.length, 3);
  assert.equal(list.find((d) => d.id === 'japan-kyoto').stale, true);
  assert.equal(service.isStale({ enrichedAt: new Date('2026-10-01') }, new Date('2026-11-05')), false);

  // the weekly refresh: asks for active rows with no data or data older than six months, a few at a time
  const now = new Date('2026-11-05T03:00:00Z');
  const done = await service.refreshStale({ now, limit: 2 });
  assert.equal(lastWhere.active, true);
  assert.equal(lastWhere.OR[1].enrichedAt.lt.toISOString().slice(0, 10), '2026-05-09');
  assert.ok(done.refreshed.length + done.failed.length >= 1);

  // deleting
  await service.remove('japan-kyoto');
  assert.equal(rows.has('japan-kyoto'), false);

  console.log('catalogService selfcheck passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
