// node src/utils/travelAdvice.selfcheck.mjs
import assert from "node:assert/strict";
import { summarizeClimate, comfortScore, bestMonths, monthAdvice, forecastAdvice } from "./travelAdvice.js";

// two years of synthetic data: January hot + wet, July mild + dry
const time = [], hi = [], lo = [], rain = [], wind = [];
for (const y of ["2023", "2024"]) {
  for (let d = 1; d <= 10; d++) { time.push(`${y}-01-${String(d).padStart(2, "0")}`); hi.push(34); lo.push(24); rain.push(d <= 5 ? 5 : 0); wind.push(10); }
  for (let d = 1; d <= 10; d++) { time.push(`${y}-07-${String(d).padStart(2, "0")}`); hi.push(23); lo.push(12); rain.push(0); wind.push(12); }
}
const months = summarizeClimate({ time, temperature_2m_max: hi, temperature_2m_min: lo, precipitation_sum: rain, wind_speed_10m_max: wind });

assert.equal(months.length, 12);
assert.equal(months[0].highC, 34);
assert.equal(months[0].rainyDayPct, 0.5);
assert.equal(months[0].rainMm, 25); // 50mm over 2 years -> 25 per month
assert.equal(months[1].highC, null); // months with no data stay null, not NaN

assert.ok(comfortScore(months[6]) > comfortScore(months[0]), "mild dry July should beat hot wet January");
assert.equal(comfortScore(months[1]), null);
assert.equal(bestMonths(months, 1)[0], 7);

assert.ok(monthAdvice(months[0]).some((t) => t.kind === "hot"));
assert.ok(monthAdvice(months[0]).some((t) => t.kind === "rain"));
assert.ok(monthAdvice(months[6]).some((t) => t.kind === "dry"));
assert.deepEqual(monthAdvice(null), []);

const f = forecastAdvice([{ date: "2026-10-05", description: "light rain", temp: 15 }, { date: "2026-10-06", description: "clear sky", temp: 34 }]);
assert.ok(f.some((t) => t.kind === "rain" && t.text.includes("Monday")));
assert.ok(f.some((t) => t.kind === "hot"));
assert.equal(forecastAdvice([{ date: "2026-10-05", description: "clear sky", temp: 20 }])[0].kind, "mild");
assert.deepEqual(forecastAdvice([]), []);
console.log("travelAdvice selfcheck: all assertions passed");
