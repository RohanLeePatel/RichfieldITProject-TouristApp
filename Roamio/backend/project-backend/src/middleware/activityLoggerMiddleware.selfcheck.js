// The trip feed's lines come from describeChange: each change it should log,
// and the reads and unrelated paths it must not.
// node src/middleware/activityLoggerMiddleware.selfcheck.js
const assert = require('node:assert/strict');
const { describeChange } = require('./activityLoggerMiddleware');

const details = (...args) => describeChange(...args)?.details;

assert.deepEqual(describeChange('POST', '/api/trips', {}, { trip: { id: 28 } }), { tripId: 28, action: 'TRIP_CREATED', entityType: 'TRIP', details: 'created the trip' });
assert.equal(describeChange('POST', '/api/trips', {}, {}), null); // no id, nothing to attach it to
assert.equal(details('POST', '/api/trips/28/itinerary', { title: 'Albert Park', dayNumber: 2 }), 'added Albert Park to day 2');
assert.equal(details('DELETE', '/api/trips/28/itinerary/5'), 'removed a stop');
assert.equal(details('POST', '/api/trips/28/expenses', { title: 'Taxi', amount: 20, currency: 'usd' }), 'recorded Taxi (20 USD)');
assert.equal(details('POST', '/api/trips/28/expenses', { title: 'Lunch', amount: 90 }), 'recorded Lunch (90)');
assert.equal(details('DELETE', '/api/trips/28/expenses/3fa2-uuid'), 'deleted an expense');
assert.equal(details('PUT', '/api/trips/28/budget', { totalAmount: 2000 }), 'updated the budget');
assert.equal(details('PUT', '/api/trips/28/budget/categories/FOOD', { limitAmount: 500 }), 'set a limit for food');
assert.equal(details('POST', '/api/trips/28/documents', { filename: 'ticket.pdf' }), 'attached ticket.pdf');
assert.equal(describeChange('POST', '/api/trips/28/itinerary', {}).tripId, 28);

assert.equal(describeChange('PUT', '/api/trips/28/budget/summary'), null);
assert.equal(describeChange('DELETE', '/api/trips/28/budget/categories/FOOD'), null);
assert.equal(describeChange('DELETE', '/api/trips/28'), null); // the trip is gone; nowhere to show it
assert.equal(describeChange('POST', '/api/groups'), null);

console.log('activityLogger selfcheck: all assertions passed');
