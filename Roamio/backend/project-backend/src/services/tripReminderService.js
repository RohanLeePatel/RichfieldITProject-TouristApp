const prisma = require('../config/prisma');
const { notifyUser } = require('./pushService');

const DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [7, 1]; // how long before the start date a trip's members are reminded

const dayText = (days) => (days === 1 ? 'tomorrow' : `in ${days} days`);

// Reminds the members of every trip that starts exactly 7 days, or 1 day, from
// today (UTC). The daily cron calls it; the dedupe key means a second run on the
// same day, or a retry, never notifies twice. A day the cron misses is not made up.
async function sendTripReminders(now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let tripsReminded = 0;

  for (const days of REMINDER_DAYS) {
    const from = new Date(today + days * DAY);
    const trips = await prisma.trip.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        startDate: { gte: from, lt: new Date(from.getTime() + DAY) },
      },
      select: { id: true, title: true, members: { select: { userId: true } } },
    });

    for (const trip of trips) {
      tripsReminded += 1;
      await Promise.all(trip.members.map((m) => notifyUser(m.userId, {
        type: 'TRIP_UPDATE',
        topic: 'travelUpdates',
        title: `"${trip.title}" starts ${dayText(days)}`,
        body: days === 1 ? 'Last chance to check your itinerary, documents and packing.' : 'A good time to check your itinerary, documents and safety advice.',
        url: `/trips/${trip.id}`,
        tripId: trip.id,
        dedupeKey: `reminder:${trip.id}:${days}`,
      })));
    }
  }
  return { tripsReminded };
}

module.exports = { sendTripReminders, REMINDER_DAYS };
