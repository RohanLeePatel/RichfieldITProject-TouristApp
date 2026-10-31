// Turns a flat list of picked landmarks (each with lat/lon, from /landmarks)
// into a day-by-day agenda: geographic day-grouping + in-day ordering + rough
// start/end times. Pure, frontend-only, no network calls - see
// C:\Users\hp\.claude\plans\magical-brewing-barto.md Part 2c for the design.

const STOPS_PER_DAY_BY_PACE = { packed: 5, balanced: 3, relaxed: 2 };
const DEFAULT_STOPS_PER_DAY = STOPS_PER_DAY_BY_PACE.balanced;

const DURATION_MIN_BY_CATEGORY = {
  "entertainment.museum": 120,
  "entertainment.theme_park": 120,
  "entertainment.zoo": 120,
  "entertainment.aquarium": 120,
  "leisure.park": 90,
  "natural.beach": 90,
  "natural.mountain": 90,
  "catering.restaurant": 60,
  "catering.cafe": 60,
  "catering.fast_food": 60,
};
const DEFAULT_DURATION_MIN = 90;
const DAY_START_MIN = 9 * 60; // 09:00, in minutes-from-midnight
const MEAL_TARGETS_MIN = [12 * 60, 19 * 60]; // lunch, dinner

function stopDurationMin(landmark) {
  return DURATION_MIN_BY_CATEGORY[landmark?.category] ?? DEFAULT_DURATION_MIN;
}

function minutesToTime(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isCatering(landmark) {
  return (landmark?.category || "").startsWith("catering.");
}

// No routing API - approximate the gap to the *next* stop from straight-line
// distance instead of a flat constant, so two stops across the street don't
// get the same buffer as two stops on opposite sides of town.
function travelGapMin(distanceMeters) {
  const WALK_THRESHOLD_M = 1500;
  const WALK_SPEED_M_PER_MIN = 75; // ~4.5 km/h
  if (distanceMeters <= WALK_THRESHOLD_M) {
    return Math.max(10, Math.round(distanceMeters / WALK_SPEED_M_PER_MIN));
  }
  return 30; // assume a short taxi/transit ride beyond comfortable walking distance
}

// Best-effort only - OSM opening_hours syntax is a small language ("Mo-Fr
// 08:00-18:00; Sa 09:00-13:00; PH off") that's a real parser to handle fully.
// This only recognizes the common single daily range case; anything more
// complex (multiple day groups, exceptions) is left unchecked rather than
// risk a wrong "closed" flag from a naive parse.
const SIMPLE_HOURS_PATTERN = /^\D*(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})\D*$/;
export function isLikelyClosed(landmark, startTime) {
  const hours = landmark?.opening_hours;
  if (!hours) return false;
  const match = SIMPLE_HOURS_PATTERN.exec(hours.trim());
  if (!match) return false; // too complex to parse - don't guess
  const [, openH, openM, closeH, closeM] = match.map(Number);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  const stopMin = timeToMinutes(startTime);
  return stopMin < openMin || stopMin >= closeMin;
}

function haversineMeters(a, b) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function centroidOf(landmarks) {
  const lat = landmarks.reduce((sum, l) => sum + l.lat, 0) / landmarks.length;
  const lon = landmarks.reduce((sum, l) => sum + l.lon, 0) / landmarks.length;
  return { lat, lon };
}

// Simple nearest-neighbor walk starting from whichever stop is closest to the
// centroid - cheap and good enough at the small (<= ~5) sizes a single day holds.
function nearestNeighborOrder(landmarks, centroid) {
  const remaining = [...landmarks];
  remaining.sort(
    (a, b) => haversineMeters(centroid, a) - haversineMeters(centroid, b)
  );
  const ordered = [remaining.shift()];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDist = Infinity;
    remaining.forEach((candidate, index) => {
      const dist = haversineMeters(last, candidate);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = index;
      }
    });
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }
  return ordered;
}

// Assigns startTime/endTime to an already-ordered list of landmarks, starting
// at DAY_START_MIN, with the gap to each next stop derived from real distance
// (see travelGapMin). Shared by the initial build and every manual re-order,
// so times always stay consistent with the same rule.
export function recomputeDayStopTimes(landmarks) {
  let cursor = DAY_START_MIN;
  return landmarks.map((landmark, index) => {
    const duration = stopDurationMin(landmark);
    const startTime = minutesToTime(cursor);
    const endTime = minutesToTime(cursor + duration);
    const next = landmarks[index + 1];
    const gap = next ? travelGapMin(haversineMeters(landmark, next)) : 0;
    cursor += duration + gap;
    return { landmark, startTime, endTime };
  });
}

// Repositions catering stops (restaurant/cafe/fast_food) toward typical meal
// times instead of leaving them wherever the geographic walk put them - tries
// every position for each catering stop and keeps whichever minimizes the gap
// to the nearest meal target. O(n^2) but n is small (a single day's stops).
function biasTowardMealTimes(orderedLandmarks) {
  const cateringStops = orderedLandmarks.filter(isCatering);
  if (cateringStops.length === 0) return orderedLandmarks;

  let stops = orderedLandmarks.filter((landmark) => !isCatering(landmark));
  cateringStops.forEach((landmark) => {
    let bestPos = 0;
    let bestDiff = Infinity;
    for (let pos = 0; pos <= stops.length; pos++) {
      const trial = [...stops.slice(0, pos), landmark, ...stops.slice(pos)];
      const startMin = timeToMinutes(recomputeDayStopTimes(trial)[pos].startTime);
      const diff = Math.min(...MEAL_TARGETS_MIN.map((target) => Math.abs(target - startMin)));
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPos = pos;
      }
    }
    stops = [...stops.slice(0, bestPos), landmark, ...stops.slice(bestPos)];
  });
  return stops;
}

// Chunks a centroid-angle-sorted list into contiguous day-groups using a
// classic simple VRP "sweep" heuristic (keeps each group in roughly the same
// part of town instead of a plain distance-ring split, which would mix all
// directions within the same ring) - with a lighter first day, since an
// arrival day realistically has less usable time than a full day in town.
// The last day isn't specially thinned too - guessing which day is a
// "departure day" without real flight/checkout info isn't worth the extra
// complexity; drag-and-drop already lets the user lighten it by hand.
const arrivalCapFor = (stopsPerDay) => Math.max(1, Math.round(stopsPerDay / 2));

// Kids need more slack than the pace label alone accounts for - every day
// gets the same lighter treatment the sweep already gives the arrival day,
// not just the first one.
function stopsPerDayFor(pace, familyFriendly) {
  const base = STOPS_PER_DAY_BY_PACE[pace] ?? DEFAULT_STOPS_PER_DAY;
  return familyFriendly ? Math.max(2, base - 1) : base;
}

// The same split chunkIntoDays makes, so "pick for me" and the picker's
// "about N days" agree with the plan that gets built.
export function dayCapacity(days, pace, familyFriendly) {
  const perDay = stopsPerDayFor(pace, familyFriendly);
  return arrivalCapFor(perDay) + Math.max(0, days - 1) * perDay;
}

export function daysNeeded(count, pace, familyFriendly) {
  const perDay = stopsPerDayFor(pace, familyFriendly);
  const first = arrivalCapFor(perDay);
  return count <= first ? 1 : 1 + Math.ceil((count - first) / perDay);
}

function chunkIntoDays(list, stopsPerDay) {
  const arrivalCap = arrivalCapFor(stopsPerDay);
  const groups = [];
  let index = 0;
  let isFirstDay = true;
  while (index < list.length) {
    const size = isFirstDay ? arrivalCap : stopsPerDay;
    groups.push(list.slice(index, index + size));
    index += size;
    isFirstDay = false;
  }
  return groups;
}

// Precise mode: the user set an explicit stop count per day instead of
// taking the pace default. Same never-drop guarantee as chunkIntoDays - if
// the counts add up to less than the full list, the remainder spills into
// one extra day rather than being silently dropped.
function chunkByCounts(list, counts) {
  const groups = [];
  let index = 0;
  counts.forEach((count) => {
    if (index >= list.length) return;
    const size = Math.max(1, count);
    groups.push(list.slice(index, index + size));
    index += size;
  });
  if (index < list.length) groups.push(list.slice(index));
  return groups;
}

/**
 * @param {{ landmarks: Array<{name, lat, lon, category, address}>, tripDays: number, pace: "packed"|"balanced"|"relaxed", dayStopCounts?: number[], familyFriendly?: boolean }} args
 * @returns {Array<{ dayNumber: number, stops: Array<{ landmark, startTime, endTime }> }>}
 */
export function buildDayPlan({ landmarks, pace, dayStopCounts, familyFriendly }) {
  if (!landmarks || landmarks.length === 0) return [];

  // familyFriendly is ignored once the user takes precise per-day control
  // (dayStopCounts) - that's already an explicit override.
  const stopsPerDay = stopsPerDayFor(pace, familyFriendly);
  const centroid = centroidOf(landmarks);

  const sortedByAngle = [...landmarks].sort((a, b) => {
    const angleA = Math.atan2(a.lat - centroid.lat, a.lon - centroid.lon);
    const angleB = Math.atan2(b.lat - centroid.lat, b.lon - centroid.lon);
    return angleA - angleB;
  });

  // Never silently drop a stop the user picked - if the selection needs more
  // days than tripDays allows, chunking just produces more groups than
  // tripDays; the caller compares dayGroups.length to tripDays to surface that.
  const dayGroups =
    dayStopCounts && dayStopCounts.length > 0
      ? chunkByCounts(sortedByAngle, dayStopCounts)
      : chunkIntoDays(sortedByAngle, stopsPerDay);

  return dayGroups.map((group, index) => ({
    dayNumber: index + 1,
    stops: recomputeDayStopTimes(biasTowardMealTimes(nearestNeighborOrder(group, centroid))),
  }));
}

// Groups already-saved itinerary items (from GET /api/trips/:id, or the dev
// store) by dayNumber, sorted by day then startTime - used by the trip detail
// page. Items saved before dayNumber existed (or added another way) land in
// a trailing { dayNumber: null } group instead of being silently hidden.
export function groupItineraryByDay(itinerary) {
  if (!itinerary || itinerary.length === 0) return [];
  const byDay = new Map();
  itinerary.forEach((item) => {
    const key = item.dayNumber ?? "unscheduled";
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item);
  });
  const scheduled = [...byDay.entries()]
    .filter(([key]) => key !== "unscheduled")
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, items]) => ({
      dayNumber,
      items: [...items].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    }));
  const unscheduled = byDay.get("unscheduled");
  return unscheduled ? [...scheduled, { dayNumber: null, items: unscheduled }] : scheduled;
}

// A day is "overloaded" if it's still going past a reasonable dinner-and-out
// hour - a simple last-stop-endTime check, not a real fatigue model, but
// enough to flag a day that quietly ran long from too many stops or too much
// travel time between them.
const LATE_DAY_THRESHOLD_MIN = 20 * 60; // 20:00
export function isDayOverloaded(stops) {
  if (!stops || stops.length === 0) return false;
  const lastStop = stops[stops.length - 1];
  return timeToMinutes(lastStop.endTime) > LATE_DAY_THRESHOLD_MIN;
}

export { STOPS_PER_DAY_BY_PACE };
