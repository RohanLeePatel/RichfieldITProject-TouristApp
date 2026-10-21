// The wizard's group step, pre-filled from Travel Group members.
// node src/pages/recommendations/constants.selfcheck.mjs
import assert from "node:assert/strict";

import { groupFromFamily } from "./constants.js";

const group = groupFromFamily([
  { name: "Thandi", type: "Adult", interests: ["Beaches", "Cafes"] },
  { name: "Sipho", type: "Child", age: "8", interests: ["Playgrounds"] },
  { name: "Lwazi", type: "Child", age: "", interests: [] }, // age unknown: not guessed
  { name: "Ann", type: "Adult", interests: ["Photography"] }, // not a wizard tag
]);
assert.equal(group.adults, "3"); // you + 2 adults
assert.equal(group.children, "8");
assert.deepEqual(group.travelers.map((t) => [t.name, t.interests]), [["Thandi", ["beaches", "cafes"]], ["Sipho", ["playgrounds"]]]);

assert.deepEqual(groupFromFamily(null), { adults: "1", children: "", travelers: [] });
console.log("wizard group selfcheck: all assertions passed");
