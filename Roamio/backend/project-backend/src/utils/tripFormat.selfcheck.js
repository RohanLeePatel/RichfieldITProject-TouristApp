// node src/utils/tripFormat.selfcheck.js
const assert = require('node:assert/strict');
const { packMeta, unpackMeta, packItemMeta, unpackItemMeta, itemStartDate, formatTime, formatTrip } = require('./tripFormat');

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
// item coordinates round-trip, and notes-only items stay plain text
assert.deepEqual(unpackItemMeta(packItemMeta({ notes: 'bring cash', lat: -33.9, lon: 18.4 })), { notes: 'bring cash', lat: -33.9, lon: 18.4 });
assert.equal(packItemMeta({ notes: 'bring cash' }), 'bring cash'); // no coords -> stays plain
assert.equal(packItemMeta({}), null);
assert.deepEqual(unpackItemMeta(packItemMeta({ lat: 0, lon: 0 })), { notes: null, lat: 0, lon: 0 }); // 0,0 is valid
assert.deepEqual(unpackItemMeta('old plain note'), { notes: 'old plain note', lat: null, lon: null }); // pre-existing rows
assert.deepEqual(unpackItemMeta(null), { notes: null, lat: null, lon: null });
assert.deepEqual(unpackItemMeta('42'), { notes: '42', lat: null, lon: null }); // parses as JSON but isn't an object
assert.deepEqual(unpackItemMeta('{"notes":null,"lat":"nope","lon":5}'), { notes: null, lat: null, lon: 5 }); // junk coord dropped
assert.equal(packItemMeta({ notes: 'x', lat: NaN, lon: 2 }), 'x'); // partial coords are no coords

const withCoords = formatTrip({ id: 2, title: 'z', description: packMeta({}), itinerary: [{ id: 'v', title: 'w', dayNumber: 1, startTime: d, description: packItemMeta({ notes: 'n', lat: 1.5, lon: 2.5 }) }] });
assert.equal(withCoords.itinerary[0].lat, 1.5);
assert.equal(withCoords.itinerary[0].notes, 'n');

// Prisma's relation is `itineraries`; the API keeps the frontend's `itinerary`
const fromPrisma = formatTrip({ id: 3, title: 'p', description: null, travelGroupId: 9, itineraries: [{ id: 'q', title: 'r', dayNumber: 2, startTime: d }], _count: { itineraries: 1 } });
assert.equal(fromPrisma.itinerary.length, 1);
assert.deepEqual(fromPrisma._count, { itinerary: 1 });
assert.equal(fromPrisma.travelGroupId, 9);
assert.equal('members' in fromPrisma, false); // only present when loaded

// the wizard's extras round-trip (B2); a trip saved without them reads back as before
const extras = { currency: 'ZAR', travellers: { adults: 2, childAges: [8] }, interests: ['beaches'] };
const withExtras = formatTrip({ id: 4, title: 'd', description: packMeta({ destination: 'Durban, South Africa', budget: 4000, ...extras }) });
assert.deepEqual([withExtras.currency, withExtras.travellers, withExtras.interests], [extras.currency, extras.travellers, extras.interests]);
assert.equal(packMeta({ destination: 'A' }), '{"destination":"A","budget":null,"notes":null}');
const plain = formatTrip({ id: 5, title: 'e', description: packMeta({ destination: 'A' }) });
assert.deepEqual([plain.currency, plain.travellers, plain.interests], [null, null, []]);

// moving a stop to another day: it gets a new last slot there (no clash with a time
// already in use), and the day it left keeps its earliest slot
{
  const { planReorder } = require('./tripFormat');
  const at = (day, time) => itemStartDate('2027-03-10', day, time);
  const stops = [
    { id: 1, dayNumber: 1, startTime: at(1, '09:00') },
    { id: 2, dayNumber: 1, startTime: at(1, '10:40') },
    { id: 3, dayNumber: 2, startTime: at(2, '09:00') },
    { id: 4, dayNumber: 2, startTime: at(2, '10:40') },
  ];
  const moved = planReorder(stops, '2027-03-10', [{ dayNumber: 1, itemIds: [2] }, { dayNumber: 2, itemIds: [3, 4, 1] }]);
  assert.deepEqual(moved.map((u) => [u.id, u.dayNumber, formatTime(u.startTime)]), [[2, 1, '09:00'], [3, 2, '09:00'], [4, 2, '10:40'], [1, 2, '12:20']]);
  const swapped = planReorder(stops, '2027-03-10', [{ dayNumber: 1, itemIds: [2, 1] }]);
  assert.deepEqual(swapped.map((u) => [u.id, formatTime(u.startTime)]), [[2, '09:00'], [1, '10:40']]);
  assert.equal(planReorder(stops, '2027-03-10', [{ dayNumber: 1, itemIds: [1, 1] }]), null);
}

console.log('tripFormat selfcheck: all assertions passed');
