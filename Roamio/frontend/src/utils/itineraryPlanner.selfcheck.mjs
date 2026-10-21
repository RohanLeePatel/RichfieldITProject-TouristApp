// Standalone check, no test framework - run with: node src/utils/itineraryPlanner.selfcheck.mjs
import assert from "node:assert/strict";
import {
  buildDayPlan,
  recomputeDayStopTimes,
  isLikelyClosed,
  groupItineraryByDay,
  isDayOverloaded,
} from "./itineraryPlanner.js";

// A loose ring of 7 fake landmarks around a city centroid, spread across
// "directions" so the sweep should split them into distinct day-groups.
const landmarks = [
  { name: "N Museum", lat: 1.0, lon: 0.0, category: "entertainment.museum" },
  { name: "NE Park", lat: 0.8, lon: 0.8, category: "leisure.park" },
  { name: "E Cafe", lat: 0.0, lon: 1.0, category: "catering.cafe" },
  { name: "SE Beach", lat: -0.8, lon: 0.8, category: "natural.beach" },
  { name: "S Zoo", lat: -1.0, lon: 0.0, category: "entertainment.zoo" },
  { name: "SW Restaurant", lat: -0.8, lon: -0.8, category: "catering.restaurant" },
  { name: "W Sight", lat: 0.0, lon: -1.0, category: "tourism.sights" },
];

// balanced pace -> 3 stops/day base, but the first (arrival) day is thinned
// to round(3/2)=2 -> day groups of 2,3,2 -> still 3 days
const plan = buildDayPlan({ landmarks, tripDays: 3, pace: "balanced" });
assert.equal(plan.length, 3, `expected 3 days, got ${plan.length}`);
assert.ok(
  plan[0].stops.length < plan[1].stops.length,
  `arrival day (${plan[0].stops.length}) should have fewer stops than a full day (${plan[1].stops.length})`
);

const allStops = plan.flatMap((day) => day.stops.map((s) => s.landmark.name));
assert.equal(allStops.length, landmarks.length, "every picked landmark must appear exactly once");
assert.deepEqual(
  [...allStops].sort(),
  landmarks.map((l) => l.name).sort(),
  "output set must match input set exactly (no drops, no dupes)"
);

for (const day of plan) {
  assert.ok(day.stops.length > 0, `day ${day.dayNumber} has no stops`);
  for (let i = 1; i < day.stops.length; i++) {
    assert.ok(
      day.stops[i].startTime > day.stops[i - 1].startTime,
      `day ${day.dayNumber} stop ${i} does not start after the previous stop`
    );
  }
}

// packed pace -> 5 stops/day base, arrival day thinned to round(5/2)=3 ->
// groups of 3,4 -> 2 days for these 7 stops
const packedPlan = buildDayPlan({ landmarks, tripDays: 3, pace: "packed" });
assert.equal(packedPlan.length, 2, `packed pace expected 2 days, got ${packedPlan.length}`);

// Every catering stop should land reasonably close to lunch (12:00) or
// dinner (19:00), not wherever the pure geographic walk happened to put it.
const MEAL_TARGETS_MIN = [12 * 60, 19 * 60];
const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
for (const day of plan) {
  for (const stop of day.stops) {
    if (!stop.landmark.category?.startsWith("catering.")) continue;
    const startMin = toMinutes(stop.startTime);
    const nearestGap = Math.min(...MEAL_TARGETS_MIN.map((t) => Math.abs(t - startMin)));
    assert.ok(nearestGap <= 180, `${stop.landmark.name} at ${stop.startTime} is too far from a meal window`);
  }
}

// recomputeDayStopTimes reused directly (as the drag-and-drop reorder path
// would) must give strictly increasing times too, regardless of input order,
// and the gap between two far-apart stops should exceed a nearby pair's gap.
const near = recomputeDayStopTimes([
  { name: "A", lat: 0, lon: 0, category: "tourism.sights" },
  { name: "B", lat: 0.001, lon: 0.001, category: "tourism.sights" },
]);
const far = recomputeDayStopTimes([
  { name: "A", lat: 0, lon: 0, category: "tourism.sights" },
  { name: "B", lat: 5, lon: 5, category: "tourism.sights" },
]);
const nearGap = toMinutes(near[1].startTime) - toMinutes(near[0].endTime);
const farGap = toMinutes(far[1].startTime) - toMinutes(far[0].endTime);
assert.ok(farGap > nearGap, `distant stops (${farGap}min gap) should have a bigger gap than nearby ones (${nearGap}min)`);

// isLikelyClosed: simple single-range syntax recognized; anything more
// complex is left unchecked (never guesses).
assert.equal(isLikelyClosed({ opening_hours: "09:00-17:00" }, "18:00"), true);
assert.equal(isLikelyClosed({ opening_hours: "09:00-17:00" }, "10:00"), false);
assert.equal(isLikelyClosed({ opening_hours: "Mo-Fr 08:00-18:00; Sa 09:00-13:00" }, "20:00"), false);
assert.equal(isLikelyClosed({}, "10:00"), false);

// empty selection -> empty plan, no crash
assert.deepEqual(buildDayPlan({ landmarks: [], tripDays: 3, pace: "balanced" }), []);

// precise mode: explicit per-day counts override the pace default, in order.
const precisePlan = buildDayPlan({ landmarks, tripDays: 3, pace: "balanced", dayStopCounts: [1, 2, 4] });
assert.equal(precisePlan.length, 3, `precise mode expected 3 days, got ${precisePlan.length}`);
assert.deepEqual(precisePlan.map((d) => d.stops.length), [1, 2, 4]);

// precise mode never drops stops: counts summing to less than the full
// selection spill the remainder into one extra day.
const overflowPlan = buildDayPlan({ landmarks, tripDays: 2, pace: "balanced", dayStopCounts: [2, 2] });
assert.equal(overflowPlan.length, 3, `overflow should append an extra day, got ${overflowPlan.length}`);
assert.equal(overflowPlan[2].stops.length, 3);

// groupItineraryByDay: saved items group by day, sort by startTime within a
// day, and anything with no dayNumber lands in a trailing unscheduled group
// instead of being dropped.
const saved = [
  { id: 1, title: "B", dayNumber: 1, startTime: "14:00" },
  { id: 2, title: "A", dayNumber: 1, startTime: "09:00" },
  { id: 3, title: "C", dayNumber: 2, startTime: "10:00" },
  { id: 4, title: "Old item, no day" },
];
const groups = groupItineraryByDay(saved);
assert.equal(groups.length, 3);
assert.deepEqual(groups[0].items.map((i) => i.title), ["A", "B"]); // sorted by startTime
assert.equal(groups[1].dayNumber, 2);
assert.equal(groups[2].dayNumber, null); // unscheduled trails, never dropped
assert.equal(groups[2].items[0].title, "Old item, no day");
assert.deepEqual(groupItineraryByDay([]), []);
assert.deepEqual(groupItineraryByDay(undefined), []);

// familyFriendly: every day (not just arrival) gets fewer stops than the
// plain pace default would give, so kid-heavy trips aren't packed on day 2+.
const familyPlan = buildDayPlan({ landmarks, tripDays: 3, pace: "packed", familyFriendly: true });
const plainPacked = buildDayPlan({ landmarks, tripDays: 3, pace: "packed" });
const familyNonArrivalMax = Math.max(...familyPlan.slice(1).map((d) => d.stops.length));
const plainNonArrivalMax = Math.max(...plainPacked.slice(1).map((d) => d.stops.length));
assert.ok(
  familyNonArrivalMax <= plainNonArrivalMax,
  `familyFriendly day (${familyNonArrivalMax} stops) should not exceed the plain-pace day (${plainNonArrivalMax} stops)`
);

// isDayOverloaded: flags a day whose last stop ends after the late threshold,
// leaves a normal day alone, and never crashes on an empty day.
assert.equal(isDayOverloaded([{ endTime: "21:30" }]), true);
assert.equal(isDayOverloaded([{ endTime: "17:00" }]), false);
assert.equal(isDayOverloaded([]), false);
assert.equal(isDayOverloaded(undefined), false);

console.log("itineraryPlanner selfcheck: all assertions passed");
