// Translates between the API's trip shape (destination, budget, notes,
// startTime "HH:MM") and the LIVE Supabase schema, which has no such columns:
//   Trip.description holds destination/budget/notes as JSON, and
//   ItineraryItem.startTime is a full timestamp (NOT NULL).
// TODO(db): if Trip ever gains real destination/budget columns, drop packMeta.

const NO_DATE_BASE = Date.UTC(2000, 0, 1); // day 1 when the trip has no start date

function packMeta({ destination, budget, notes }) {
  return JSON.stringify({ destination: destination ?? null, budget: budget ?? null, notes: notes ?? null });
}

function unpackMeta(description) {
  try {
    const meta = JSON.parse(description);
    if (meta && typeof meta === 'object') return meta;
  } catch {
    // plain-text description written by someone else - treat it as notes
  }
  return { destination: null, budget: null, notes: description || null };
}

// "09:00" (or "9:00 AM") on day N of the trip -> a UTC timestamp.
function itemStartDate(tripStartDate, dayNumber, startTime) {
  const base = tripStartDate ? Date.parse(new Date(tripStartDate).toISOString().slice(0, 10)) : NO_DATE_BASE;
  const match = /^(\d{1,2}):(\d{2})/.exec(startTime || '');
  const minutes = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  return new Date(base + ((dayNumber || 1) - 1) * 86_400_000 + minutes * 60_000);
}

function formatTime(date) {
  const d = new Date(date);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function formatItem(item) {
  return {
    id: item.id,
    title: item.title,
    location: item.location,
    dayNumber: item.dayNumber,
    startTime: formatTime(item.startTime),
    notes: item.description,
  };
}

function formatTrip(trip) {
  const { destination, budget, notes } = unpackMeta(trip.description);
  return {
    id: trip.id,
    title: trip.title,
    destination,
    budget,
    notes,
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    createdAt: trip.createdAt,
    ...(trip.itinerary ? { itinerary: trip.itinerary.map(formatItem) } : {}),
    ...(trip._count ? { _count: trip._count } : {}),
  };
}

// Trips the user can see: they're a trip member, or a member of its group.
const accessibleTrips = (userId, extra = {}) => ({
  deletedAt: null,
  OR: [{ members: { some: { userId } } }, { travelGroup: { members: { some: { userId } } } }],
  ...extra,
});

module.exports = { packMeta, unpackMeta, itemStartDate, formatTime, formatItem, formatTrip, accessibleTrips };
