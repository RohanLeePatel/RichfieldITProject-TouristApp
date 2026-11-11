// node src/components/recommendations/TripDone.selfcheck.mjs
// Regression: the Plan a Trip completion screen used to send people to /family,
// whose group invites never contained the new (solo) trip, so the recipient's
// link could not open it. It must reuse the trip's own invite flow
// (TripInviteLink -> shareTrip(tripId) -> /join/CODE?trip=ID), the same one the
// trip page's People tab uses. There is no React test runner here, so this checks
// the wiring in the source; the browser check covers the rendered flow.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const done = read("./TripDone.jsx");
const hub = read("../trips/TripHub.jsx");

assert.match(done, /<TripInviteLink tripId=\{tripId\}/, "completion screen invites through TripInviteLink for this trip");
assert.doesNotMatch(done, /to="\/family"/, "completion screen no longer hands off to the group page");
assert.match(hub, /<TripInviteLink tripId=\{trip\.id\}/, "People tab uses the same component");
assert.match(hub, /shareTrip\(tripId\)[\s\S]*inviteLink\(shared\.inviteCode, tripId\)/, "link carries the shared group's code and the trip id");
console.log("TripDone selfcheck: all assertions passed");
