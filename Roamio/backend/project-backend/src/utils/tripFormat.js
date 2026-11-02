// Translates between the API's trip shape (destination, budget, notes,
// startTime "HH:MM") and the LIVE Supabase schema, which has no such columns:
//   Trip.description holds destination/budget/notes as JSON, and
//   ItineraryItem.startTime is a full timestamp (NOT NULL).
// TODO(db): if Trip ever gains real destination/budget columns, drop packMeta.

const NO_DATE_BASE = Date.UTC(2000, 0, 1); // day 1 when the trip has no start date

// currency / travellers / interests are what the wizard collected; written only
// when given, so trips saved before they existed read back unchanged.
function packMeta({ destination, budget, notes, currency, travellers, interests }) {
  return JSON.stringify({
    destination: destination ?? null,
    budget: budget ?? null,
    notes: notes ?? null,
    ...(currency ? { currency } : {}),
    ...(travellers ? { travellers } : {}),
    ...(interests?.length ? { interests } : {}),
  });
}

// ItineraryItem has no lat/lon columns either, so a stop's coordinates ride
// along in its description next to the notes - same trick as packMeta above.
// Without them a saved trip can't be drawn on a map: the only other thing
// stored is `location`, a display string, which would need re-geocoding.
function packItemMeta({ notes, lat, lon }) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
  if (!hasCoords) return notes ?? null;
  return JSON.stringify({ notes: notes ?? null, lat, lon });
}

function unpackItemMeta(description) {
  try {
    const meta = JSON.parse(description);
    // a bare number or string parses as JSON too, so check it's really an object
    if (meta && typeof meta === 'object') {
      return {
        notes: meta.notes ?? null,
        lat: Number.isFinite(meta.lat) ? meta.lat : null,
        lon: Number.isFinite(meta.lon) ? meta.lon : null,
      };
    }
  } catch {
    // plain-text notes, written before coordinates were stored
  }
  return { notes: description || null, lat: null, lon: null };
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

// Reordering a saved itinerary. Order is by start time, so each day keeps the
// set of times it had and hands them out in the new order (move a stop up and
// it takes the earlier slot). days: [{ dayNumber, itemIds }]. Returns the
// rows to update, or null if an id isn't one of the items or is listed twice.
function planReorder(items, tripStartDate, days) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set();
  const updates = [];
  for (const { dayNumber, itemIds } of days) {
    const times = [];
    for (const id of itemIds) {
      if (!byId.has(id) || seen.has(id)) return null;
      seen.add(id);
      times.push(formatTime(byId.get(id).startTime));
    }
    times.sort();
    itemIds.forEach((id, index) => {
      updates.push({ id, dayNumber, startTime: itemStartDate(tripStartDate, dayNumber, times[index]) });
    });
  }
  return updates;
}

function formatTime(date) {
  const d = new Date(date);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function formatItem(item) {
  const { notes, lat, lon } = unpackItemMeta(item.description);
  return {
    id: item.id,
    title: item.title,
    location: item.location,
    dayNumber: item.dayNumber,
    startTime: formatTime(item.startTime),
    notes,
    lat,
    lon,
  };
}

function formatTrip(trip) {
  const { destination, budget, notes, currency, travellers, interests } = unpackMeta(trip.description);
  // Prisma names the relation `itineraries`; the frontend reads `itinerary`
  const items = trip.itineraries ?? trip.itinerary;
  const itemCount = trip._count?.itineraries ?? trip._count?.itinerary;
  return {
    id: trip.id,
    title: trip.title,
    destination,
    budget,
    notes,
    currency: currency ?? null,
    travellers: travellers ?? null,
    interests: interests ?? [],
    startDate: trip.startDate,
    endDate: trip.endDate,
    status: trip.status,
    travelGroupId: trip.travelGroupId,
    createdAt: trip.createdAt,
    ...(items ? { itinerary: items.map(formatItem) } : {}),
    ...(itemCount !== undefined ? { _count: { itinerary: itemCount } } : {}),
    // group-trip detail (GET /api/trips/:id), same shape the src/ trip API returned
    ...(trip.members ? { members: trip.members } : {}),
    ...(trip.destinations ? { destinations: trip.destinations } : {}),
  };
}

// Trips the user can see: they're a trip member, or a member of its group.
const accessibleTrips = (userId, extra = {}) => ({
  deletedAt: null,
  OR: [{ members: { some: { userId } } }, { travelGroup: { members: { some: { userId } } } }],
  ...extra,
});

module.exports = { planReorder, packMeta, unpackMeta, packItemMeta, unpackItemMeta, itemStartDate, formatTime, formatItem, formatTrip, accessibleTrips };
