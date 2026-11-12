// Ratings and place reports: who may post, input limits, one report per traveller,
// and when a place counts as flagged. Uses a stand-in for Prisma, no database.
// node src/services/destinationFeedbackService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const users = { 1: { isVerified: true, isActive: true, deletedAt: null }, 2: { isVerified: false, isActive: true, deletedAt: null } };
const past = new Date(Date.now() - 86400000);
const future = new Date(Date.now() + 86400000);
const meta = (destination) => JSON.stringify({ destination, budget: null, notes: null });
// User 1 has a finished trip to Cape Town and an unfinished trip to Durban.
const trips = [
  { id: 7, status: 'PLANNING', startDate: past, endDate: past, description: meta('Cape Town,  South Africa') },
  { id: 8, status: 'PLANNING', startDate: past, endDate: future, description: meta('Durban, South Africa') },
];
const itinerary = [
  { id: 'old', tripId: 8, title: 'Market', dayNumber: 1, startTime: new Date('2026-01-01T09:00Z') },
  { id: 'future', tripId: 8, title: 'Museum', dayNumber: 3, startTime: new Date('2026-01-03T09:00Z') },
  { id: 'elsewhere', tripId: 7, title: 'Beach', dayNumber: 1, startTime: past },
  { id: 'unscheduled', tripId: 8, title: 'Walk', dayNumber: null, startTime: past },
];
const reviews = [];
const reports = [];

const fakePrisma = {
  user: { findUnique: async ({ where }) => users[where.id] || null },
  trip: { findMany: async ({ where }) => (where.members.some.userId === 1 ? trips.filter((trip) => !where.id || trip.id === where.id) : []) },
  itineraryItem: { findFirst: async ({ where }) => itinerary.find((item) => item.id === where.id && item.tripId === where.tripId) },
  placeReview: {
    create: async ({ data }) => {
      if (reviews.some((r) => r.userId === data.userId && r.placeKey === data.placeKey)) throw Object.assign(new Error('dup'), { code: 'P2002' });
      const row = { id: reviews.length + 1, ...data };
      reviews.push(row);
      return { id: row.id, rating: row.rating, comment: row.comment };
    },
  },
  placeReport: {
    create: async ({ data }) => {
      if (reports.some((r) => r.userId === data.userId && r.placeKey === data.placeKey)) throw Object.assign(new Error('dup'), { code: 'P2002' });
      reports.push({ status: 'OPEN', createdAt: new Date(), ...data });
    },
    groupBy: async () => {
      const keys = [...new Set(reports.filter((r) => r.status === 'OPEN').map((r) => r.placeKey))];
      return keys.map((placeKey) => {
        const rows = reports.filter((r) => r.placeKey === placeKey && r.status === 'OPEN');
        return { placeKey, placeName: rows[0].placeName, _count: { _all: rows.length }, _max: { createdAt: rows[0].createdAt } };
      });
    },
    findMany: async () => reports.filter((r) => r.status === 'OPEN'),
    updateMany: async ({ where, data }) => {
      const rows = reports.filter((r) => r.placeKey === where.placeKey && r.status === where.status);
      rows.forEach((r) => Object.assign(r, data));
      return { count: rows.length };
    },
  },
};

const prismaPath = require.resolve(path.join(__dirname, '../config/prisma'));
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
const service = require('./destinationFeedbackService');

const rejects = (promise, status) =>
  assert.rejects(promise, (err) => { assert.equal(err.statusCode, status, err.message); return true; });

(async () => {
  // reviews: input first, then who may post
  await rejects(service.review(1, { place: 'Cape Town, South Africa', rating: 6 }), 400);
  await rejects(service.review(1, { place: 'Cape Town, South Africa', rating: 4, comment: 'x'.repeat(501) }), 400);
  await rejects(service.review(1, { place: '', rating: 4 }), 400);
  await rejects(service.review(2, { place: 'Cape Town, South Africa', rating: 4 }), 403); // email not verified
  await rejects(service.review(1, { place: 'Durban, South Africa', rating: 4 }), 403); // trip not finished yet
  await rejects(service.review(1, { place: 'Lima, Peru', rating: 4 }), 403); // never went
  assert.equal((await service.review(1, { place: 'cape town, south africa', rating: 4, comment: ' lovely ' })).comment, 'lovely'); // wording and spacing don't matter
  await rejects(service.review(1, { place: 'Cape Town, South Africa', rating: 2 }), 409);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].rating, 4);

  // reports: reason checked, an unfinished trip counts, once per traveller
  await rejects(service.report(1, { place: 'Durban, South Africa', reason: 'RUDE' }), 400);
  await rejects(service.report(1, { place: 'Lima, Peru', reason: 'CLOSED' }), 403);
  const stopReport = { tripId: 8, place: 'Durban, South Africa', reason: 'CLOSED', note: 'shut for repairs' };
  for (const itineraryItemId of ['future', 'elsewhere', 'unscheduled']) {
    await rejects(service.report(1, { ...stopReport, itineraryItemId }), 400);
  }
  await rejects(service.report(1, { ...stopReport, tripId: 7, itineraryItemId: 'elsewhere' }), 403);
  await service.report(1, { ...stopReport, itineraryItemId: 'old' });
  await rejects(service.report(1, { place: 'DURBAN, South Africa', reason: 'SCAM' }), 409);

  // flagged only once 3 different travellers report
  let [row] = await service.openReports();
  assert.equal(row.reportCount, 1);
  assert.equal(row.reports[0].itineraryStop, 'Day 1 · 09:00 · Market');
  assert.equal(row.flagged, false);
  for (const userId of [3, 4]) reports.push({ userId, placeKey: 'durban, south africa', placeName: 'Durban, South Africa', reason: 'UNSAFE', status: 'OPEN', createdAt: new Date() });
  [row] = await service.openReports();
  assert.equal(row.flagged, true);
  assert.equal(row.name, 'Durban, South Africa');

  // an admin closes the lot
  await rejects(service.closeReports('durban, south africa', 'OPEN'), 400);
  assert.equal((await service.closeReports('durban, south africa', 'DISMISSED')).updated, 3);
  assert.equal((await service.openReports()).length, 0);

  console.log('destinationFeedbackService selfcheck passed');
})().catch((err) => { console.error(err); process.exit(1); });
