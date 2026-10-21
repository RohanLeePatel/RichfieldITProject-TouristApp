// node src/utils/expenseTotals.selfcheck.js
const assert = require('node:assert/strict');
const { expenseTotals, crossedThresholds, warningFor } = require('./expenseTotals');

// a rand budget: R100 lunch, and a $10 taxi recorded at R18.20/$ (a Prisma Decimal-like value)
const decimal = (value) => ({ toString: () => String(value) });
const totals = expenseTotals([
  { amount: decimal('100.00'), exchangeRate: null, category: 'FOOD', paidById: 1, splits: [{ userId: 1, shareAmount: decimal('50.00') }, { userId: 2, shareAmount: decimal('50.00') }] },
  { amount: decimal('10.00'), exchangeRate: decimal('18.2'), category: 'TRANSPORT', paidById: 2, splits: [{ userId: 1, shareAmount: decimal('5.00') }, { userId: 2, shareAmount: decimal('5.00') }] },
]);
assert.equal(totals.totalCents, 28200); // R100 + R182, not "110"
assert.deepEqual(totals.byCategory.get('TRANSPORT'), { cents: 18200, count: 1 });
assert.equal(totals.paid.get(2), 18200);
assert.equal(totals.owed.get(1), 5000 + 9100);
assert.equal(expenseTotals([]).totalCents, 0);

// 80% / 100% are reported once, on the change that crosses them
assert.deepEqual(crossedThresholds(7000, 8500, 10000), [0.8]);
assert.deepEqual(crossedThresholds(7000, 10000, 10000), [0.8, 1]);
assert.deepEqual(crossedThresholds(8500, 9000, 10000), []);
assert.deepEqual(crossedThresholds(0, 500, 0), []); // no budget, no warning

assert.equal(warningFor('Trip budget', 7000, 10000, 'ZAR'), null);
assert.equal(warningFor('Trip budget', 8500, 10000, 'ZAR'), 'Trip budget: 85% used (85.00 ZAR of 100.00 ZAR)');
assert.equal(warningFor('Trip budget', 12000, 10000, 'ZAR'), 'Trip budget exceeded by 20.00 ZAR');
console.log('expenseTotals selfcheck: all assertions passed');
