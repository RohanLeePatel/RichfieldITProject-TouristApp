import { authedFetch, isDevBypass } from "./client";

// DEV-ONLY: no database is configured on the Node backend yet, so a real
// POST /api/trips 500s and itinerary saves would too. When there's no real
// token (i.e. the Login page's "Skip login" dev bypass was used) fall back
// to a localStorage-backed fake store so the rest of the wizard - landmarks,
// itinerary, the "trip created" screen - can still be exercised end to end.
// Remove this fallback once DATABASE_URL is wired up; real sessions
// (a real token present) always go through the real API untouched.
const DEV_TRIPS_KEY = "roamio_dev_trips";

function readDevTrips() {
  try {
    return JSON.parse(localStorage.getItem(DEV_TRIPS_KEY)) || [];
  } catch {
    return [];
  }
}

function writeDevTrips(trips) {
  localStorage.setItem(DEV_TRIPS_KEY, JSON.stringify(trips));
}

export async function createTrip({ title, destination, budget, startDate, endDate, currency, travellers, interests, travelGroupId }) {
  if (isDevBypass()) {
    const trips = readDevTrips();
    const trip = { id: Date.now(), title, destination, budget, startDate, endDate, itinerary: [] };
    trips.push(trip);
    writeDevTrips(trips);
    return trip;
  }

  const result = await authedFetch("/api/trips", {
    method: "POST",
    body: JSON.stringify({ title, destination, budget, startDate, endDate, currency, travellers, interests, travelGroupId }),
  });
  return result.trip;
}

export async function fetchTrips() {
  if (isDevBypass()) return readDevTrips();

  const result = await authedFetch("/api/trips");
  return result.trips;
}

export async function fetchTrip(tripId) {
  if (isDevBypass()) {
    const trip = readDevTrips().find((t) => String(t.id) === String(tripId));
    if (!trip) throw new Error("Trip not found.");
    return trip;
  }

  const result = await authedFetch(`/api/trips/${tripId}`);
  return result.trip;
}

export async function deleteTrip(tripId) {
  if (isDevBypass()) {
    writeDevTrips(readDevTrips().filter((t) => t.id !== tripId));
    return;
  }

  await authedFetch(`/api/trips/${tripId}`, { method: "DELETE" });
}

export async function addItineraryItem(tripId, { title, location, dayNumber, startTime, lat, lon }) {
  if (isDevBypass()) {
    const trips = readDevTrips();
    const trip = trips.find((t) => t.id === tripId);
    const item = { id: Date.now() + Math.random(), title, location, dayNumber, startTime, lat, lon };
    if (trip) {
      trip.itinerary.push(item);
      writeDevTrips(trips);
    }
    return item;
  }

  const result = await authedFetch(`/api/trips/${tripId}/itinerary`, {
    method: "POST",
    body: JSON.stringify({ title, location, dayNumber, startTime, lat, lon }),
  });
  return result.item;
}

export async function removeItineraryItem(tripId, itemId) {
  if (isDevBypass()) {
    const trips = readDevTrips();
    const trip = trips.find((t) => t.id === tripId);
    if (trip) {
      trip.itinerary = trip.itinerary.filter((item) => item.id !== itemId);
      writeDevTrips(trips);
    }
    return;
  }

  await authedFetch(`/api/trips/${tripId}/itinerary/${itemId}`, { method: "DELETE" });
}

// The join code for inviting people to this trip. A solo trip is moved into a
// group of its own first (organizer only). { inviteCode, travelGroupId, groupName }
export function shareTrip(tripId) {
  return authedFetch(`/api/trips/${tripId}/share`, { method: "POST" });
}

// Edit a saved trip: any of title, destination, budget, notes, startDate and
// endDate (the dates go together; null clears them). A 409 carries the stops
// that fall outside the new dates in error.data.items.
export async function updateTrip(tripId, changes) {
  const result = await authedFetch(`/api/trips/${tripId}`, { method: "PATCH", body: JSON.stringify(changes) });
  return result.trip;
}

// days: [{ dayNumber, itemIds }] - each day's stops, top to bottom
export function reorderItinerary(tripId, days) {
  return authedFetch(`/api/trips/${tripId}/itinerary/order`, { method: "PUT", body: JSON.stringify({ days }) });
}

// Trips deleted in the last 30 days, and bringing one back
export async function fetchDeletedTrips() {
  const result = await authedFetch("/api/trips/deleted");
  return result.trips;
}

export async function restoreTrip(tripId) {
  const result = await authedFetch(`/api/trips/${tripId}/restore`, { method: "POST" });
  return result.trip;
}
