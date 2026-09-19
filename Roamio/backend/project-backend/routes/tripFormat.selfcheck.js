// node routes/tripFormat.selfcheck.js
const assert = require('node:assert/strict');
const { packMeta, unpackMeta, itemStartDate, formatTime, formatTrip } = require('./tripFormat');

assert.deepEqual(unpackMeta(packMeta({ destination: 'Lima, Peru', budget: 1000 })), { destination: 'Lima, Peru', budget: 1000, notes: null });
assert.deepEqual(unpackMeta('just a note'), { destination: null, budget: null, notes: 'just a note' });
assert.deepEqual(unpackMeta(null), { destination: null, budget: null, notes: null });

// day 2 at 09:30 of a trip starting 2026-10-01 -> 2026-10-02T09:30Z, and back to "09:30"
const d = itemStartDate('2026-10-01', 2, '09:30');
assert.equal(d.toISOString(), '2026-10-02T09:30:00.000Z');
assert.equal(formatTime(d), '09:30');
assert.equal(itemStartDate(null, 1, '14:05').toISOString(), '2000-01-01T14:05:00.000Z'); // no trip date
assert.equal(formatTime(itemStartDate(null, 1, 'garbage')), '00:00');

const t = formatTrip({ id: 1, title: 'x', description: packMeta({ destination: 'A', budget: 5 }), itinerary: [{ id: 'u', title: 'y', dayNumber: 1, startTime: d }] });
assert.equal(t.destination, 'A');
assert.equal(t.itinerary[0].startTime, '09:30');
console.log('tripFormat selfcheck: all assertions passed');
