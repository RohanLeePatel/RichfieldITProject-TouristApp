const prisma = require('../config/prisma');
const { httpError } = require('./tripAccessService');
const { unpackMeta } = require('../utils/tripFormat');
const { sendPlaceReportThanks } = require('./emailService');

const REASONS = ['CLOSED', 'UNSAFE', 'WRONG_INFO', 'SCAM', 'OTHER'];
// distinct travellers who must report a place before it shows as flagged to admins
const FLAG_AT = 3;

const text = (value) => (typeof value === 'string' ? value.trim() : '');
// "Cape Town,  South Africa" and "cape town, south africa" are the same place
const placeKey = (name) => name.toLowerCase().replace(/\s+/g, ' ').slice(0, 160);

function parsePlace(raw) {
  const name = text(raw).replace(/\s+/g, ' ').slice(0, 160);
  if (name.length < 2) throw httpError(400, 'Which place?');
  return { placeName: name, placeKey: placeKey(name) };
}

// Signed-in, verified, active accounts only; one gate for both writes.
async function assertCanPost(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isVerified: true, isActive: true, deletedAt: true } });
  if (!user || !user.isActive || user.deletedAt) throw httpError(403, 'This account cannot post.');
  if (!user.isVerified) throw httpError(403, 'Verify your email before posting.');
  return user;
}

// The user's trip to this place (direct TripMember rows only), or null.
// A review needs a finished trip (marked COMPLETED, or its end date has passed);
// a report may come from any trip that isn't cancelled.
async function tripToPlace(userId, key, finishedOnly) {
  const trips = await prisma.trip.findMany({
    where: { deletedAt: null, status: { not: 'CANCELLED' }, members: { some: { userId } } },
    select: { id: true, status: true, endDate: true, description: true },
  });
  const now = new Date();
  return trips.find((trip) => {
    const destination = unpackMeta(trip.description).destination;
    if (typeof destination !== 'string' || placeKey(text(destination).replace(/\s+/g, ' ')) !== key) return false;
    return !finishedOnly || trip.status === 'COMPLETED' || (trip.endDate && trip.endDate < now);
  }) || null;
}

async function review(userId, body) {
  const place = parsePlace(body?.place);
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Rating must be 1 to 5.');
  const comment = text(body?.comment);
  if (comment.length > 500) throw httpError(400, 'Keep the comment under 500 characters.');

  await assertCanPost(userId);
  const trip = await tripToPlace(userId, place.placeKey, true);
  if (!trip) throw httpError(403, 'You can rate a place after a finished trip there.');

  const data = { ...place, rating, comment: comment || null, tripId: trip.id, updatedAt: new Date() };
  return prisma.placeReview.upsert({
    where: { userId_placeKey: { userId, placeKey: place.placeKey } },
    update: data,
    create: { userId, ...data },
    select: { id: true, rating: true, comment: true },
  });
}

async function report(userId, body) {
  const place = parsePlace(body?.place);
  const reason = text(body?.reason);
  if (!REASONS.includes(reason)) throw httpError(400, 'Choose a reason.');
  const note = text(body?.note);
  if (note.length > 300) throw httpError(400, 'Keep the note under 300 characters.');

  const user = await assertCanPost(userId);
  if (!(await tripToPlace(userId, place.placeKey, false))) throw httpError(403, 'You can report places on your own trips.');
  try {
    await prisma.placeReport.create({ data: { userId, ...place, reason, note: note || null } });
  } catch (err) {
    if (err.code === 'P2002') throw httpError(409, 'You already reported this place.');
    throw err;
  }
  if (user.email) sendPlaceReportThanks(user.email, place.placeName); // not awaited: never fails the report
  return { reported: true };
}

// { avgRating, reviewCount, mine } for one place
async function summary(userId, rawPlace) {
  const { placeKey: key } = parsePlace(rawPlace);
  const [agg, mine] = await Promise.all([
    prisma.placeReview.aggregate({ where: { placeKey: key }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.placeReview.findUnique({ where: { userId_placeKey: { userId, placeKey: key } }, select: { rating: true, comment: true } }),
  ]);
  return {
    avgRating: agg._avg.rating == null ? null : Math.round(agg._avg.rating * 10) / 10,
    reviewCount: agg._count._all,
    mine,
  };
}

// Admin queue: places with open reports, most-reported first. flagged = enough distinct reporters.
async function openReports() {
  const [groups, reports] = await Promise.all([
    prisma.placeReport.groupBy({ by: ['placeKey', 'placeName'], where: { status: 'OPEN' }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.placeReport.findMany({ where: { status: 'OPEN' }, select: { placeKey: true, reason: true, note: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  return groups
    .map((g) => ({
      placeKey: g.placeKey,
      name: g.placeName,
      reportCount: g._count._all,
      flagged: g._count._all >= FLAG_AT,
      lastReportedAt: g._max.createdAt,
      reports: reports.filter((r) => r.placeKey === g.placeKey),
    }))
    .sort((a, b) => b.reportCount - a.reportCount);
}

async function closeReports(rawKey, status) {
  if (!['RESOLVED', 'DISMISSED'].includes(status)) throw httpError(400, 'status must be RESOLVED or DISMISSED.');
  const key = text(rawKey).toLowerCase();
  if (!key) throw httpError(400, 'placeKey is required.');
  const { count } = await prisma.placeReport.updateMany({ where: { placeKey: key, status: 'OPEN' }, data: { status } });
  return { updated: count };
}

module.exports = { review, report, summary, openReports, closeReports, REASONS, FLAG_AT };
