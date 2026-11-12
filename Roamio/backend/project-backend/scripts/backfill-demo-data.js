// From project-backend: node scripts/backfill-demo-data.js [--end=YYYY-MM-DD] [--apply]
// Default: preview the last 30 complete UTC days without connecting to a database.
// Apply: set BACKFILL_DATABASE_URL and APP_ENCRYPTION_KEY for the same target environment.
const { randomBytes, randomUUID } = require('node:crypto');
const { packMeta, itemStartDate } = require('../src/utils/tripFormat');

const DAY = 86_400_000;
const HOUR = 3_600_000;
const WINDOW = 30;
const DOMAIN = 'roamio-demo.invalid';
const MARKER = '[Roamio Demo]';
const DESTINATIONS = [
  ['Cape Town', 'South Africa', 'ZAR'], ['Lisbon', 'Portugal', 'EUR'],
  ['Paris', 'France', 'EUR'], ['Tokyo', 'Japan', 'JPY'],
];
const DEVICES = [
  { deviceType: 'desktop', browser: 'Chrome', os: 'Windows' },
  { deviceType: 'mobile', browser: 'Safari', os: 'iOS' },
  { deviceType: 'mobile', browser: 'Chrome', os: 'Android' },
];
const dateKey = (ms) => new Date(ms).toISOString().slice(0, 10);

function plan(end) {
  return Array.from({ length: WINDOW }, (_, offset) => {
    const midnight = end - (WINDOW - 1 - offset) * DAY;
    const day = midnight / DAY;
    const date = dateKey(midnight);
    const count = 3 + ((day * 7 + Math.floor(day / 7)) % 4);
    const people = Array.from({ length: count }, (_, i) => ({
      email: `seed-${date}-${i + 1}@${DOMAIN}`,
      fullName: `${MARKER} Traveller ${date} / ${i + 1}`,
      isVerified: i < count - 1 || day % 3 === 0,
    }));
    return { day, date, midnight, people, hasSoloTrip: count >= 5 };
  });
}

async function seedDay(tx, cohort, end, passwordHash, landmarks) {
  const { day, date, midnight, people, hasSoloTrip } = cohort;
  const at = (hour) => new Date(midnight + hour * HOUR);
  const emails = people.map((person) => person.email);
  const sqlDemoPassword = `ROAMIO_DEMO_SQL_DISABLED:${date}`;
  const existing = await tx.user.findMany({
    where: { OR: [{ email: { in: emails } }, { passwordHash: sqlDemoPassword }] },
    select: { fullName: true, passwordHash: true },
  });
  if (existing.length) {
    if (existing.length !== people.length || existing.some((row) => row.passwordHash !== sqlDemoPassword && !row.fullName.startsWith(MARKER))) {
      throw new Error(`Demo account markers are incomplete or conflict on ${date}.`);
    }
    return false;
  }

  const users = await tx.user.createManyAndReturn({
    data: people.map((person) => ({ ...person, passwordHash, createdAt: at(8), updatedAt: at(8) })),
    select: { id: true, email: true },
  });
  const idsByEmail = new Map(users.map(({ email, id }) => [email, id]));
  const ids = emails.map((email) => idsByEmail.get(email));

  await tx.userPreference.createMany({ data: ids.map((userId, i) => ({
    userId, language: ['en', 'en', 'fr', 'ja'][(day + i) % 4],
    currency: DESTINATIONS[(day + i) % DESTINATIONS.length][2],
    theme: ['system', 'light', 'dark'][i % 3], emailAlerts: false, pushAlerts: false, updatedAt: at(8),
  })) });
  await tx.loginEvent.createMany({ data: people.flatMap(({ isVerified }, i) => {
    if (!isVerified) return [];
    const login = { userId: ids[i], success: true, ...DEVICES[(day + i) % DEVICES.length] };
    const firstLogin = { ...login, at: at(9) };
    return midnight < end && (day + i) % 3 !== 0 ? [firstLogin, { ...login, at: at(24 + 10) }] : [firstLogin];
  }) });
  await tx.wizardStepEvent.createMany({ data: people.flatMap(({ isVerified }, i) => {
    const steps = isVerified ? Math.max(5 - i - (day % 2), 0) : 0;
    return Array.from({ length: steps }, (_, step) => ({ userId: ids[i], step, at: at(10 + step / 10) }));
  }) });

  const tripMembers = hasSoloTrip ? [ids.slice(0, 2), ids.slice(2, 3)] : [ids.slice(0, 2)];
  for (const [index, members] of tripMembers.entries()) {
    const [ownerId, guestId] = members;
    const destinationIndex = (day + Math.floor(day / 4) + index) % DESTINATIONS.length;
    const [city, country, currency] = DESTINATIONS[destinationIndex];
    const destination = `${city}, ${country}`;
    const title = `${MARKER} ${city} · ${date}`;
    const scale = currency === 'EUR' ? 1 : currency === 'ZAR' ? 20 : 150;
    const budget = (380 + (day % 9) * 20) * scale;
    const completed = midnight + 2 * DAY <= end;
    const startDate = new Date(midnight + DAY);
    const endDate = new Date(midnight + 2 * DAY);
    const landmark = completed && landmarks[destinationIndex];
    const group = await tx.travelGroup.create({
      data: {
        name: title, createdAt: at(11), updatedAt: at(11),
        members: { create: members.map((userId, i) => ({ userId, role: i ? 'MEMBER' : 'OWNER', joinedAt: at(11) })) },
      }, select: { id: true },
    });
    const trip = await tx.trip.create({
      data: {
        travelGroupId: group.id, title, description: packMeta({ destination, budget, currency, notes: MARKER }),
        startDate, endDate, status: completed ? 'COMPLETED' : 'PLANNING', createdAt: at(12),
        updatedAt: completed ? endDate : at(12),
        members: { create: members.map((userId, i) => ({ userId, role: i ? 'COLLABORATOR' : 'ORGANIZER', joinedAt: at(12) })) },
        ...(landmark && { destinations: { create: { destinationId: landmark.id, scheduledDay: 1, createdAt: at(13) } } }),
        budget: { create: { totalAmount: budget, currency, createdAt: at(12), updatedAt: at(12) } },
        itineraries: { create: ['City walk', 'Local market'].map((item, i) => ({
          title: item, location: destination, dayNumber: i + 1, startTime: itemStartDate(startDate, i + 1, '10:00'),
          createdAt: at(13), updatedAt: at(13),
        })) },
      }, select: { id: true },
    });

    const categories = ['ACCOMMODATION', 'TRANSPORT', 'FOOD', 'ACTIVITY', 'MISC'];
    for (const [i, title] of ['Booking deposit', 'Local transport', 'Trip supplies'].entries()) {
      const amount = (i === 0 ? 96 : 12 + ((day + i) % 8) * 2) * scale;
      await tx.expense.create({ data: {
        tripId: trip.id, title, amount, currency, paidById: ownerId,
        category: i < 2 ? categories[i] : categories[2 + day % 3],
        date: at(15 + i), createdAt: at(15 + i), updatedAt: at(15 + i),
        splits: { create: members.map((userId, m) => ({ userId, shareAmount: amount / members.length, isSettled: m === 0 || day % 3 === 0 })) },
      } });
    }
    await tx.chatConversation.create({ data: {
      userId: ownerId, tripId: trip.id, title: `${MARKER} ${city} planning`, createdAt: at(14), updatedAt: at(14.1),
      messages: { create: [
        { role: 'user', content: `What should I pack for a weekend in ${city}?`, createdAt: at(14) },
        { role: 'assistant', content: 'Bring comfortable walking shoes, layers and a reusable water bottle.', createdAt: at(14.1) },
      ] },
    } });
    await tx.translation_history.create({ data: {
      user_id: String(ownerId), translation_type: 'TEXT', source_lang: 'en', detected_lang: 'en', target_lang: 'fr',
      source_text: 'Where is the station?', translated_text: 'Où est la gare ?', created_at: at(14),
    } });

    if (guestId) {
      await tx.invitation.createMany({ data: [
        { email: people[1].email, status: 'ACCEPTED' },
        { email: `guest-${date}@${DOMAIN}`, status: 'EXPIRED' },
      ].slice(0, day % 3 === 0 ? 2 : 1).map((invite) => ({
        ...invite, travelGroupId: group.id, inviterId: ownerId, token: randomUUID(),
        createdAt: at(11), expiresAt: at(23),
      })) });
      await tx.notification.create({ data: {
        userId: guestId, tripId: trip.id, type: 'TRIP_UPDATE', title: `${MARKER} Trip ready`,
        message: `Your group planned a trip to ${city}.`, isRead: day % 3 !== 0, createdAt: at(14),
      } });
    }
  }
  return true;
}

async function apply(cohorts, end) {
  const connectionString = process.env.BACKFILL_DATABASE_URL ?? '';
  const url = URL.canParse(connectionString) ? new URL(connectionString) : null;
  if (!url?.hostname || url.pathname.length < 2 || !['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('Set BACKFILL_DATABASE_URL to a PostgreSQL connection URL with a host and database name.');
  }
  const { getKey, decryptText } = require('../src/utils/fieldCrypto');
  const { PrismaClient } = require('../src/generated/prisma');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { withColumnEncryption } = require('../src/utils/columnEncryption');
  getKey();
  const passwordHash = await require('bcrypt').hash(randomBytes(32).toString('hex'), 12);
  const prisma = withColumnEncryption(new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 10_000 }),
  }));
  try {
    return await prisma.$transaction(async (tx) => {
      const [{ locked }] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext('roamio-demo-backfill-v1')) AS locked`;
      if (!locked) throw new Error('Another demo backfill is in progress.');

      const [sample] = await tx.$queryRaw`SELECT email FROM "User" WHERE email LIKE 'enc:v1:%' LIMIT 1`;
      if (sample) decryptText(sample.email, 'User.email');
      const landmarks = await Promise.all(DESTINATIONS.map(([city, country]) => tx.destination.findFirst({
        where: { city: { name: city, country: { name: country } } }, orderBy: { id: 'asc' }, select: { id: true },
      })));
      let added = 0;
      for (const cohort of cohorts) added += Number(await seedDay(tx, cohort, end, passwordHash, landmarks));
      return added;
    }, { maxWait: 10_000, timeout: 300_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main(args) {
  if (args.some((arg) => arg !== '--apply' && !/^--end=\d{4}-\d{2}-\d{2}$/.test(arg)) ||
      new Set(args.map((arg) => arg.split('=')[0])).size !== args.length) {
    throw new Error('Usage: node scripts/backfill-demo-data.js [--end=YYYY-MM-DD] [--apply]');
  }
  const yesterday = dateKey(Date.now() - DAY);
  const endDate = args.find((arg) => arg.startsWith('--end='))?.slice(6) ?? yesterday;
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(end) || dateKey(end) !== endDate || endDate > yesterday || endDate < '2000-01-30') {
    throw new Error('--end must be a valid UTC date from 2000-01-30 through yesterday.');
  }
  const cohorts = plan(end);
  const count = cohorts.reduce((sum, cohort) => sum + cohort.people.length, 0);
  const trips = cohorts.length + cohorts.filter((cohort) => cohort.hasSoloTrip).length;
  console.log(`${args.includes('--apply') ? 'Backfill' : 'Offline preview'} for ${cohorts[0].date} through ${endDate} (UTC).`);
  console.log(`Full window: ${count} demo users, ${trips} trips and ${trips * 3} expenses, plus related activity.`);
  if (args.includes('--apply')) {
    const added = await apply(cohorts, end);
    console.log(`Committed ${added} demo days. Skipped ${WINDOW - added} days already seeded.`);
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
