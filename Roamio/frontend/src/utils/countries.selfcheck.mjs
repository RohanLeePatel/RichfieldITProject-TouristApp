// Every catalog country has an entry, and destinations split the way trips store them.
// node src/utils/countries.selfcheck.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { COUNTRIES, splitDestination } from "./countries.js";

const seed = JSON.parse(readFileSync(new URL("../../../backend/travel-intelligence/data/destinations_seed.json", import.meta.url)));
for (const country of new Set(seed.map((d) => d.country))) assert.ok(COUNTRIES[country], `missing ${country}`);
for (const { iso3 } of Object.values(COUNTRIES)) assert.match(iso3, /^[A-Z]{3}$/);

assert.deepEqual(splitDestination("Durban, South Africa"), { city: "Durban", country: "South Africa", info: COUNTRIES["South Africa"] });
assert.equal(splitDestination("Durban").info, null);
assert.equal(splitDestination(null).city, "");
console.log("countries selfcheck: all assertions passed");

