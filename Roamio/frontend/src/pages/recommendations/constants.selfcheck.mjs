// The wizard's group step, pre-filled from Travel Group members.
// node src/pages/recommendations/constants.selfcheck.mjs
import assert from "node:assert/strict";

import { groupFromFamily, groupFromTravelGroup } from "./constants.js";

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
// a travel group: you + 2 other account holders + its companions (age 0 is a real age)
const travelGroup = groupFromTravelGroup({
  members: [{ userId: 1 }, { userId: 2 }, { userId: 3 }],
  companions: [{ name: "Mia", type: "Child", age: 0, interests: ["Beaches"] }, { name: "Gran", type: "Adult", interests: [] }],
});
assert.equal(travelGroup.adults, "4");
assert.equal(travelGroup.children, "0");
assert.deepEqual(travelGroup.travelers.map((t) => t.name), ["Mia"]);
assert.deepEqual(groupFromTravelGroup(null), { adults: "1", children: "", travelers: [] });
console.log("wizard group selfcheck: all assertions passed");
