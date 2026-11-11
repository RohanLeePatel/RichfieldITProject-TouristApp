const prisma = require('../config/prisma');

// Read-only reports for the admin dashboard, from Roamio's own tables:
// who the audience is, how notifications are doing, what people spend, and where
// travel-safety data stands. Money, devices and languages are counted as they are
// stored; nothing here is personal data about one named traveller.

const DAY = 86_400_000;
const RANGES = [7, 30, 90];
const TOP = 8;
const SAFETY_STALE_DAYS = 3; // the advisory sync runs every 12 hours
const HIGH_RISK = 3; // 3 = reconsider travel, 4 = do not travel

const pickDays = (value) => (RANGES.includes(Number(value)) ? Number(value) : 30);
const windowOf = (days, now) => ({ from: new Date(now - days * DAY), prevFrom: new Date(now - 2 * days * DAY) });
const topN = (rows) => rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, TOP);
const share = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

// ---------- Audience ----------

// People counted once per device, browser or system they signed in with in the period
async function audience({ days, now = Date.now() } = {}) {
  const range = pickDays(days);
  const { from } = windowOf(range, now);
  const [logins, language, currency, theme] = await Promise.all([
    prisma.loginEvent.findMany({ where: { success: true, at: { gte: from } }, select: { userId: true, deviceType: true, browser: true, os: true } }),
    prisma.userPreference.groupBy({ by: ['language'], _count: { _all: true } }),
    prisma.userPreference.groupBy({ by: ['currency'], _count: { _all: true } }),
    prisma.userPreference.groupBy({ by: ['theme'], _count: { _all: true } }),
  ]);

  const people = (field) => {
    const sets = new Map();
    for (const e of logins) {
      const label = e[field] || 'Unknown';
      if (!sets.has(label)) sets.set(label, new Set());
      sets.get(label).add(e.userId);
    }
    return topN([...sets].map(([label, set]) => ({ label, count: set.size })));
  };
  const prefs = (rows, field) => topN(rows.map((r) => ({ label: r[field], count: r._count._all })));

  return {
    days: range,
    activeUsers: new Set(logins.map((e) => e.userId)).size,
    devices: people('deviceType'),
    browsers: people('browser'),
    systems: people('os'),
    languages: prefs(language, 'language'),
    currencies: prefs(currency, 'currency'),
    themes: prefs(theme, 'theme'),
  };
}

// ---------- Notifications and push ----------

async function engagement({ days, now = Date.now() } = {}) {
  const range = pickDays(days);
  const { from, prevFrom } = windowOf(range, now);
  const [pushByUser, pushDevices, pushFailing, prefTotal, emailOn, pushOn, sent, sentBefore, read, byType] = await Promise.all([
    prisma.pushSubscription.groupBy({ by: ['userId'] }),
    prisma.pushSubscription.count(),
    prisma.pushSubscription.count({ where: { failureCount: { gt: 0 } } }),
    prisma.userPreference.count(),
    prisma.userPreference.count({ where: { emailAlerts: true } }),
    prisma.userPreference.count({ where: { pushAlerts: true } }),
    prisma.notification.count({ where: { createdAt: { gte: from } } }),
    prisma.notification.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
    prisma.notification.count({ where: { createdAt: { gte: from }, isRead: true } }),
    prisma.notification.groupBy({ by: ['type'], _count: { _all: true }, where: { createdAt: { gte: from } } }),
  ]);

  return {
    days: range,
    push: { users: pushByUser.length, devices: pushDevices, failingDevices: pushFailing },
    preferences: { total: prefTotal, emailOn, pushOn, emailRate: share(emailOn, prefTotal), pushRate: share(pushOn, prefTotal) },
    notifications: {
      sent,
      previous: sentBefore,
      read,
      readRate: share(read, sent),
      byType: topN(byType.map((t) => ({ label: t.type, count: t._count._all }))),
    },
  };
}

// ---------- Budgets and spending ----------

const money = (value) => Number(value ?? 0);

// Expenses can be in any currency, so totals are kept per currency and never added together
async function spending({ days, now = Date.now() } = {}) {
  const range = pickDays(days);
  const { from, prevFrom } = windowOf(range, now);
  const [byCurrency, byCategory, tripsWithExpenses, budgets, previous, splitsTotal, splitsSettled] = await Promise.all([
    prisma.expense.groupBy({ by: ['currency'], _sum: { amount: true }, _count: { _all: true }, where: { createdAt: { gte: from } } }),
    prisma.expense.groupBy({ by: ['category'], _count: { _all: true }, where: { createdAt: { gte: from } } }),
    prisma.expense.groupBy({ by: ['tripId'], where: { createdAt: { gte: from } } }),
    prisma.budget.groupBy({ by: ['currency'], _avg: { totalAmount: true }, _count: { _all: true } }),
    prisma.expense.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
    prisma.expenseSplit.count(),
    prisma.expenseSplit.count({ where: { isSettled: true } }),
  ]);

  const expenses = byCurrency.reduce((sum, c) => sum + c._count._all, 0);
  return {
    days: range,
    expenses: { count: expenses, previous, perTrip: tripsWithExpenses.length ? Math.round((expenses / tripsWithExpenses.length) * 10) / 10 : null },
    totals: byCurrency
      .map((c) => ({ currency: c.currency, total: money(c._sum.amount), count: c._count._all }))
      .sort((a, b) => b.count - a.count),
    categories: topN(byCategory.map((c) => ({ label: c.category, count: c._count._all }))).map((c) => ({ ...c, share: share(c.count, expenses) })),
    budgets: budgets.map((b) => ({ currency: b.currency, average: Math.round(money(b._avg.totalAmount)), count: b._count._all })).sort((a, b) => b.count - a.count),
    settlement: { total: splitsTotal, settled: splitsSettled, rate: share(splitsSettled, splitsTotal) },
  };
}

// ---------- Safety advisories ----------

async function safety({ now = Date.now() } = {}) {
  const staleBefore = now - SAFETY_STALE_DAYS * DAY;
  const [advisories, missing, openAlerts, atRisk] = await Promise.all([
    prisma.safetyAdvisory.findMany({
      select: { countryIso: true, riskLevel: true, advisoryLevel: true, lastUpdated: true, source: true, country: { select: { name: true } } },
      orderBy: [{ riskLevel: 'desc' }, { lastUpdated: 'asc' }],
    }),
    // countries travellers have planned trips to that have no advisory at all
    prisma.country.findMany({
      where: { safetyAdvisory: null, cities: { some: { destinations: { some: { tripDestinations: { some: {} } } } } } },
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.safetyAlert.groupBy({ by: ['riskLevel'], _count: { _all: true }, where: { resolvedAt: null } }),
    prisma.tripDestination.findMany({
      where: {
        trip: { deletedAt: null, status: { in: ['PLANNING', 'CONFIRMED', 'ONGOING'] }, OR: [{ endDate: null }, { endDate: { gte: new Date(now) } }] },
        destination: { city: { country: { safetyAdvisory: { riskLevel: { gte: HIGH_RISK } } } } },
      },
      select: {
        trip: { select: { id: true, title: true, status: true, startDate: true } },
        destination: { select: { city: { select: { country: { select: { name: true, safetyAdvisory: { select: { riskLevel: true } } } } } } } },
      },
      take: 200,
    }),
  ]);

  const trips = new Map();
  for (const { trip, destination } of atRisk) {
    const country = destination.city.country;
    const riskLevel = country.safetyAdvisory.riskLevel;
    const seen = trips.get(trip.id);
    if (!seen || riskLevel > seen.riskLevel) trips.set(trip.id, { ...trip, country: country.name, riskLevel });
  }

  return {
    staleAfterDays: SAFETY_STALE_DAYS,
    usingMockData: advisories.length > 0 && advisories.every((a) => a.source === 'MOCK'),
    advisories: advisories.map((a) => ({
      country: a.country.name,
      riskLevel: a.riskLevel,
      advisoryLevel: a.advisoryLevel,
      lastUpdated: a.lastUpdated,
      source: a.source,
      stale: new Date(a.lastUpdated).getTime() < staleBefore,
    })),
    missing: missing.map((c) => c.name),
    openAlerts: openAlerts.map((a) => ({ riskLevel: a.riskLevel, count: a._count._all })).sort((a, b) => b.riskLevel - a.riskLevel),
    tripsAtRisk: [...trips.values()].sort((a, b) => b.riskLevel - a.riskLevel).slice(0, 25),
  };
}

module.exports = { audience, engagement, spending, safety, RANGES };
