const prisma = require('../config/prisma');
const { unpackMeta } = require('../utils/tripFormat');

// Product analytics for the admin Overview tab, worked out from Roamio's own tables
// (what people do in the app), as opposed to Google Analytics (who visits the site).
// Every figure comes with the same figure for the period just before, so the
// dashboard can show "up/down vs. last period".

const DAY = 86_400_000;
const MAX_DAYS = 365;
const TOP = 8;

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);
// any whole number of days from 1 to 365; anything else is 30
const pickDays = (value) => (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= MAX_DAYS ? Number(value) : 30);

// The last `days` calendar days (UTC), oldest first, ending today
function dayKeys(days, now) {
  return Array.from({ length: days }, (_, i) => dayKey(now - (days - 1 - i) * DAY));
}

// Rows -> one count per day. `unique` counts distinct people per day instead of rows.
function daily(keys, rows, { at, who } = {}) {
  const buckets = new Map(keys.map((key) => [key, new Set()]));
  rows.forEach((row, i) => buckets.get(dayKey(row[at]))?.add(who ? row[who] : i));
  return keys.map((date) => ({ date, value: buckets.get(date).size }));
}

const distinct = (rows, who) => new Set(rows.map((row) => row[who])).size;

// Percentage rounded to a whole number; null when there is nothing to divide by
const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

// Lists names by how many trips picked them, with the count for the period before
function rollup(current, previous, keyOf) {
  const totals = new Map();
  const add = (list, field) => {
    for (const { destination, count } of list) {
      const key = keyOf(destination);
      const entry = totals.get(key.id) ?? { label: key.label, sub: key.sub, count: 0, previous: 0 };
      entry[field] += count;
      totals.set(key.id, entry);
    }
  };
  add(current, 'count');
  add(previous, 'previous');
  return [...totals.values()].filter((e) => e.count > 0).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, TOP);
}

async function getInsights({ days, now = Date.now() } = {}) {
  const range = pickDays(days);
  const from = new Date(now - range * DAY);
  const prevFrom = new Date(now - 2 * range * DAY);
  const keys = dayKeys(range, now);
  const inCurrent = (date) => date >= from;

  // ponytail: rows are bucketed in JS, which is fine up to a few hundred thousand rows
  // over 90 days. Move to date_trunc in SQL if the tables ever get that big.
  const [signups, logins, trips, placeGroups, prevPlaceGroups] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null, createdAt: { gte: prevFrom } }, select: { id: true, createdAt: true } }),
    prisma.loginEvent.findMany({ where: { success: true, at: { gte: prevFrom } }, select: { userId: true, at: true } }),
    prisma.trip.findMany({
      where: { deletedAt: null, createdAt: { gte: prevFrom } },
      select: { createdAt: true, description: true, _count: { select: { destinations: true } } },
    }),
    prisma.tripDestination.groupBy({ by: ['destinationId'], _count: { _all: true }, where: { createdAt: { gte: from }, trip: { deletedAt: null } } }),
    prisma.tripDestination.groupBy({ by: ['destinationId'], _count: { _all: true }, where: { createdAt: { gte: prevFrom, lt: from }, trip: { deletedAt: null } } }),
  ]);
  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });

  const newUsers = signups.filter((u) => inCurrent(u.createdAt));
  const activeNow = logins.filter((e) => inCurrent(e.at));
  const tripsNow = trips.filter((t) => inCurrent(t.createdAt));

  const kpis = {
    totalUsers: { value: totalUsers, previous: null, series: [] },
    newUsers: {
      value: newUsers.length,
      previous: signups.length - newUsers.length,
      series: daily(keys, newUsers, { at: 'createdAt' }),
    },
    activeUsers: {
      value: distinct(activeNow, 'userId'),
      previous: distinct(logins.filter((e) => !inCurrent(e.at)), 'userId'),
      series: daily(keys, activeNow, { at: 'at', who: 'userId' }),
    },
    trips: {
      value: tripsNow.length,
      previous: trips.length - tripsNow.length,
      series: daily(keys, tripsNow, { at: 'createdAt' }),
    },
  };

  // Where people are going: every place picked for a trip, rolled up three ways
  const placeIds = [...new Set([...placeGroups, ...prevPlaceGroups].map((g) => g.destinationId))];
  const places = placeIds.length
    ? await prisma.destination.findMany({
        where: { id: { in: placeIds } },
        select: { id: true, name: true, city: { select: { id: true, name: true, country: { select: { id: true, name: true } } } } },
      })
    : [];
  const placeById = new Map(places.map((p) => [p.id, p]));
  const withPlace = (groups) =>
    groups.filter((g) => placeById.has(g.destinationId)).map((g) => ({ destination: placeById.get(g.destinationId), count: g._count._all }));
  const cur = withPlace(placeGroups);
  const prev = withPlace(prevPlaceGroups);
  // Trips made through the app keep their destination as "City, Country" text in
  // Trip.description and have no TripDestination rows (those are saved landmarks), so
  // count that text too - only for trips with no rows, so none is counted twice.
  const textual = (list) =>
    list.flatMap((t) => {
      if (t._count?.destinations) return [];
      const text = unpackMeta(t.description).destination;
      if (typeof text !== 'string' || !text.trim()) return [];
      const parts = text.split(',').map((x) => x.trim()).filter(Boolean);
      if (!parts.length) return [];
      const country = parts.length > 1 ? parts[parts.length - 1] : '';
      const city = parts.length > 1 ? parts.slice(0, -1).join(', ') : parts[0];
      return [{ destination: { text: true, city: { name: city, country: { name: country } } }, count: 1 }];
    });
  const curAll = [...cur, ...textual(tripsNow)];
  const prevAll = [...prev, ...textual(trips.filter((t) => !inCurrent(t.createdAt)))];
  const norm = (s) => s.trim().toLowerCase();
  const cityKey = (d) => ({ id: `${norm(d.city.name)}|${norm(d.city.country.name)}`, label: d.city.name, sub: d.city.country.name });
  const countryKey = (d) => ({ id: norm(d.city.country.name), label: d.city.country.name, sub: '' });
  const topDestinations = {
    places: rollup(cur, prev, (d) => ({ id: d.id, label: d.name, sub: `${d.city.name}, ${d.city.country.name}` })),
    cities: rollup(curAll, prevAll, cityKey),
    countries: rollup(curAll.filter((d) => d.destination.city.country.name), prevAll.filter((d) => d.destination.city.country.name), countryKey),
  };

  // Of the people who joined in this period: how far did they get?
  const joined = { deletedAt: null, createdAt: { gte: from } };
  const [verified, madeTrip, addedPlace, invited] = await Promise.all([
    prisma.user.count({ where: { ...joined, isVerified: true } }),
    prisma.user.count({ where: { ...joined, isVerified: true, tripMemberships: { some: {} } } }),
    prisma.user.count({ where: { ...joined, isVerified: true, tripMemberships: { some: { trip: { destinations: { some: {} } } } } } }),
    prisma.user.count({ where: { ...joined, isVerified: true, tripMemberships: { some: { trip: { destinations: { some: {} } } } }, sentInvitations: { some: {} } } }),
  ]);
  const funnel = [
    { key: 'signedUp', label: 'Signed up', count: newUsers.length },
    { key: 'verified', label: 'Verified email', count: verified },
    { key: 'madeTrip', label: 'Joined or created a trip', count: madeTrip },
    { key: 'addedPlace', label: 'Added a destination', count: addedPlace },
    { key: 'invited', label: 'Invited someone', count: invited },
  ];

  // The trip wizard: how many distinct people reached each step in this period
  const stepRows = await prisma.wizardStepEvent.findMany({ where: { at: { gte: from } }, select: { step: true, userId: true }, distinct: ['step', 'userId'] });
  const wizardFunnel = ['Trip basics', 'Interests', 'Accessibility & climate', 'Review', 'Ran a search'].map((label, step) => ({
    key: `step${step}`,
    label,
    count: stepRows.filter((r) => r.step === step).length,
  }));

  // Retention: of the new users, how many signed in again on a later day?
  const newIds = newUsers.map((u) => u.id);
  const later = newIds.length
    ? await prisma.loginEvent.findMany({ where: { success: true, userId: { in: newIds }, at: { gte: from } }, select: { userId: true, at: true } })
    : [];
  const joinedAt = new Map(newUsers.map((u) => [u.id, new Date(u.createdAt).getTime()]));
  const returned = new Set(later.filter((e) => new Date(e.at).getTime() >= joinedAt.get(e.userId) + DAY).map((e) => e.userId)).size;
  const retention = { newUsers: newUsers.length, returned, rate: percent(returned, newUsers.length) };

  // Feature usage: how many of each thing were made, this period vs. the one before
  const counted = (model, field, where = {}) =>
    Promise.all([
      prisma[model].count({ where: { ...where, [field]: { gte: from } } }),
      prisma[model].count({ where: { ...where, [field]: { gte: prevFrom, lt: from } } }),
    ]).then(([count, previous]) => ({ count, previous }));
  const features = await Promise.all(
    [
      ['trips', 'Trips planned', counted('trip', 'createdAt', { deletedAt: null })],
      ['itinerary', 'Itinerary items', counted('itineraryItem', 'createdAt')],
      ['expenses', 'Expenses logged', counted('expense', 'createdAt')],
      ['documents', 'Documents uploaded', counted('tripDocument', 'createdAt')],
      ['chat', 'Assistant questions', counted('chatMessage', 'createdAt', { role: 'user' })],
      ['translations', 'Translations', counted('translation_history', 'created_at')],
    ].map(async ([key, label, promise]) => ({ key, label, ...(await promise) })),
  );

  // Groups and invitations
  const sharedGroups = { deletedAt: null, inviteCode: { not: null } };
  const [groups, invitesSent, invitesAccepted, groupSizes] = await Promise.all([
    prisma.travelGroup.count({ where: { ...sharedGroups, members: { some: {} }, createdAt: { gte: from } } }),
    prisma.invitation.count({ where: { createdAt: { gte: from } } }),
    prisma.invitation.count({ where: { createdAt: { gte: from }, status: 'ACCEPTED' } }),
    prisma.travelGroupMember.groupBy({
      by: ['travelGroupId'],
      where: { travelGroup: sharedGroups },
      _count: { _all: true },
    }),
  ]);
  const memberTotal = groupSizes.reduce((sum, group) => sum + group._count._all, 0);
  const collaboration = {
    groups,
    invitesSent,
    invitesAccepted,
    acceptRate: percent(invitesAccepted, invitesSent),
    avgGroupSize: groupSizes.length ? Math.round((memberTotal / groupSizes.length) * 10) / 10 : null,
  };

  return { days: range, generatedAt: new Date(now).toISOString(), kpis, topDestinations, funnel, wizardFunnel, retention, features, collaboration };
}

module.exports = { getInsights };
