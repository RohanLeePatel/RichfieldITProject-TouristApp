const prisma = require('../config/prisma');
const { httpError } = require('./tripAccessService');
const { aiApiUrl, aiMessage } = require('../utils/aiService');
const { unpackMeta } = require('../utils/tripFormat');

// The cities the recommendation engine can suggest. Rows live in the
// CatalogDestination table and are managed from the admin dashboard; this file
// validates them, fills in their provider data through the AI service, and
// hands the active ones to the AI service with each recommendation request.

const aiFeaturesUrl = aiApiUrl();

const STALE_AFTER_DAYS = 180; // climate and POI counts drift; refresh twice a year
const ENRICH_TIMEOUT_MS = 50_000;
const DAY = 24 * 60 * 60 * 1000;

// Must match engine/catalog.py slugify_country: the browser sends this as parent_id
const countrySlug = (name) => name.toLowerCase().replace(/ /g, '-');

// "Kyoto" in "Japan" -> "japan-kyoto" (accents dropped, so "Zürich" -> "zurich")
const slug = (text) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const makeId = (country, name) => `${slug(country)}-${slug(name)}`;

const text = (value, label) => {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (!clean) throw httpError(400, `${label} is required.`);
  if (clean.length > 120) throw httpError(400, `${label} must be 120 characters or fewer.`);
  return clean;
};
const number = (value, label, min, max, { integer = false } = {}) => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw httpError(400, `${label} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
  }
  return n;
};
const imageUrl = (value) => {
  if (value === null || value === undefined || value === '') return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw httpError(400, 'Image must be a web address starting with https://.');
  }
  if (url.protocol !== 'https:' || String(value).length > 500) throw httpError(400, 'Image must be a web address starting with https://.');
  return url.href;
};

// The fields an administrator can set. With partial, only the ones sent are
// checked and returned (PATCH); otherwise name, country, lat and lon are required.
function validate(body = {}, { partial = false } = {}) {
  const rules = {
    name: (v) => text(v, 'Name'),
    country: (v) => text(v, 'Country'),
    lat: (v) => number(v, 'Latitude', -90, 90),
    lon: (v) => number(v, 'Longitude', -180, 180),
    radiusM: (v) => number(v, 'Search radius', 1000, 30000, { integer: true }),
    costIndex: (v) => number(v, 'Cost level', 1, 5, { integer: true }),
    imageUrl,
    active: (v) => {
      if (typeof v !== 'boolean') throw httpError(400, 'Active must be true or false.');
      return v;
    },
  };
  const defaults = { radiusM: 12000, costIndex: 3, active: true, imageUrl: null };
  const data = {};
  for (const [field, check] of Object.entries(rules)) {
    if (body[field] !== undefined) data[field] = check(body[field]);
    else if (!partial) {
      if (field in defaults) data[field] = defaults[field];
      else data[field] = check(undefined);
    }
  }
  return data;
}

const isStale = (row, now = new Date()) => !row.enrichedAt || now - new Date(row.enrichedAt) > STALE_AFTER_DAYS * DAY;

// What an administrator should fix on a city, in plain keys the dashboard words
const issuesOf = (row, now) =>
  [
    !row.imageUrl && 'no_photo',
    !row.enrichedAt && 'no_data',
    row.enrichedAt && isStale(row, now) && 'old_data',
    row.enrichError && 'fetch_failed',
  ].filter(Boolean);

const summary = (row, now) => ({
  id: row.id,
  name: row.name,
  country: row.country,
  lat: row.lat,
  lon: row.lon,
  radiusM: row.radiusM,
  costIndex: row.costIndex,
  imageUrl: row.imageUrl,
  active: row.active,
  enrichedAt: row.enrichedAt,
  enrichError: row.enrichError,
  stale: isStale(row, now),
  issues: issuesOf(row, now),
});

// Everything, active or not, for the admin list
async function listAll(now = new Date()) {
  const rows = await prisma.catalogDestination.findMany({ orderBy: [{ country: 'asc' }, { name: 'asc' }] });
  return (rows ?? []).map((row) => summary(row, now));
}

// A row in the shape the AI service's CatalogEntry expects
const toEntry = (row) => ({
  id: row.id,
  name: row.name,
  country: row.country,
  image_url: row.imageUrl,
  cost_index: row.costIndex,
  ...(row.features ?? {}),
});

// The cities that can be suggested: active, and enriched at least once (a city
// with no provider data would score as empty). [] when there are none, which
// makes the AI service use its committed seed file instead.
async function loadCatalog() {
  const rows = await prisma.catalogDestination.findMany({
    where: { active: true, enrichedAt: { not: null } },
    orderBy: { name: 'asc' },
  });
  return (rows ?? []).map(toEntry);
}

// The country list the recommendation wizard offers, from the same entries
const countriesOf = (entries) => {
  const byCountry = new Map();
  for (const e of entries) byCountry.set(e.country, (byCountry.get(e.country) || 0) + 1);
  return [...byCountry]
    .map(([name, cityCount]) => ({ id: countrySlug(name), name, city_count: cityCount }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
};

async function find(id) {
  const row = await prisma.catalogDestination.findUnique({ where: { id } });
  if (!row) throw httpError(404, 'Destination not found.');
  return row;
}

// One call to the AI service. Returns the parsed body; a failure is an error with
// a plain message (never the network error's own text, which can name internal hosts).
async function callAi(route, payload) {
  const secret = process.env.superSecretKey;
  if (!secret) throw httpError(500, 'Recommendation service authentication is not configured.');
  let response;
  let data;
  try {
    response = await fetch(`${aiFeaturesUrl}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'node-secretkey': secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ENRICH_TIMEOUT_MS),
    });
    data = await response.json().catch(() => null);
  } catch (error) {
    console.error('Destination service call failed:', error.message);
    throw httpError(502, 'The data service did not answer in time. Try again in a minute.');
  }
  if (!response.ok) {
    throw httpError([404, 503].includes(response.status) ? response.status : 502, aiMessage(data, 'The data service could not read this place.'));
  }
  return data;
}

// Asks the AI service for the provider numbers and cover photo, and stores them.
// A failure is stored too (enrichError) so the dashboard can show it, then thrown.
async function enrich(id) {
  const row = await find(id);
  let data;
  try {
    data = await callAi('/destinations/enrich', { name: row.name, country: row.country, lat: row.lat, lon: row.lon, radius_m: row.radiusM });
  } catch (error) {
    await prisma.catalogDestination.update({ where: { id }, data: { enrichError: error.message, updatedAt: new Date() } });
    throw error;
  }

  const { image_url: image, ...features } = data;
  const saved = await prisma.catalogDestination.update({
    where: { id },
    data: {
      features,
      enrichedAt: new Date(),
      enrichError: null,
      // a photo an administrator chose is never replaced
      ...(!row.imageUrl && image ? { imageUrl: image } : {}),
      updatedAt: new Date(),
    },
  });
  return summary(saved);
}

// Adds a city and fills in its data. The row is kept even if enrichment fails,
// so the administrator can retry it from the list.
async function create(input) {
  const body = { ...input };
  const noPoint = (v) => v === undefined || v === null || v === '';
  // coordinates are optional: without them the city is looked up by name
  if (noPoint(body.lat) && noPoint(body.lon)) {
    const { lat, lon } = await callAi('/destinations/geocode', { name: text(body.name, 'Name'), country: text(body.country, 'Country') });
    Object.assign(body, { lat, lon });
  }
  const data = validate(body);
  if (!slug(data.country) || !slug(data.name)) throw httpError(400, 'Use English letters or numbers in the name and country.');
  const id = makeId(data.country, data.name);
  if (await prisma.catalogDestination.findUnique({ where: { id } })) {
    throw httpError(409, `${data.name}, ${data.country} is already in the list.`);
  }
  await prisma.catalogDestination.create({ data: { id, ...data } });
  try {
    return { destination: await enrich(id), enrichError: null };
  } catch (error) {
    return { destination: summary(await find(id)), enrichError: error.message };
  }
}

async function update(id, body) {
  await find(id);
  const data = validate(body, { partial: true });
  if (!Object.keys(data).length) throw httpError(400, 'Nothing to change.');
  return summary(await prisma.catalogDestination.update({ where: { id }, data: { ...data, updatedAt: new Date() } }));
}

// How many trips use each city, by catalog id. The trip tables and the catalog are
// separate, so a city is matched by its country and name; ponytail: a name spelled
// differently in the two (e.g. "USA") counts as no demand, so match on a code if that bites.
async function tripCounts() {
  const [groups, textTrips] = await Promise.all([
    prisma.tripDestination.groupBy({ by: ['destinationId'], _count: { _all: true }, where: { trip: { deletedAt: null } } }),
    // trips made in the app keep "City, Country" as text in description and have no rows above
    prisma.trip.findMany({ where: { deletedAt: null, destinations: { none: {} } }, select: { description: true } }),
  ]);
  const counts = {};
  for (const { description } of textTrips) {
    const text = unpackMeta(description).destination;
    const parts = typeof text === 'string' ? text.split(',').map((x) => x.trim()).filter(Boolean) : [];
    if (parts.length < 2) continue;
    const id = makeId(parts[parts.length - 1], parts.slice(0, -1).join(', '));
    counts[id] = (counts[id] || 0) + 1;
  }
  if (!groups.length) return counts;
  const places = await prisma.destination.findMany({
    where: { id: { in: groups.map((g) => g.destinationId) } },
    select: { id: true, city: { select: { name: true, country: { select: { name: true } } } } },
  });
  const cityOf = new Map(places.map((p) => [p.id, makeId(p.city.country.name, p.city.name)]));
  for (const g of groups) {
    const id = cityOf.get(g.destinationId);
    if (id) counts[id] = (counts[id] || 0) + g._count._all;
  }
  return counts;
}

// Show or hide many cities at once (the bulk buttons on the dashboard)
async function setActiveMany(ids, active) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some((id) => typeof id !== 'string')) {
    throw httpError(400, 'Pick between 1 and 200 destinations.');
  }
  if (typeof active !== 'boolean') throw httpError(400, 'Active must be true or false.');
  const { count } = await prisma.catalogDestination.updateMany({ where: { id: { in: ids } }, data: { active, updatedAt: new Date() } });
  return { updated: count };
}

async function remove(id) {
  await find(id);
  await prisma.catalogDestination.delete({ where: { id } });
}

// The weekly cron: refreshes the oldest active rows that are missing data or
// older than STALE_AFTER_DAYS. A few per run, because each takes several
// seconds and the provider quota is shared.
async function refreshStale({ limit = 2, now = new Date() } = {}) {
  const rows = await prisma.catalogDestination.findMany({
    where: {
      active: true,
      OR: [{ enrichedAt: null }, { enrichedAt: { lt: new Date(now - STALE_AFTER_DAYS * DAY) } }],
    },
    orderBy: { enrichedAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
    select: { id: true },
  });
  const refreshed = [];
  const failed = [];
  for (const { id } of rows ?? []) {
    try {
      await enrich(id);
      refreshed.push(id);
    } catch (error) {
      failed.push(id); // enrich() already stored why
    }
  }
  return { refreshed, failed };
}

module.exports = {
  STALE_AFTER_DAYS,
  countrySlug,
  countriesOf,
  create,
  enrich,
  isStale,
  listAll,
  loadCatalog,
  makeId,
  refreshStale,
  remove,
  setActiveMany,
  tripCounts,
  toEntry,
  update,
  validate,
};
