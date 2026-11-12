// Expenses in another currency (B5): the rate is fetched server-side and
// stored, totals add up in the budget currency, crossing 80% / 100% notifies
// the trip's members once, and no rate means no save.
// node src/services/expenseService.selfcheck.js
const assert = require('node:assert/strict');
const path = require('node:path');

const decimal = (value) => ({ toString: () => String(value) });
const rows = []; // stored expenses
const notifications = [];
let rateCalls = 0;
let rateDown = false;
let savedShares = null; // the trip's saved split

const stub = (file, exports) => { require.cache[path.join(__dirname, file)] = { exports }; };
stub('./tripAccessService.js', {
  httpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  assertTripAccess: async () => ({ role: 'ORGANIZER' }),
});
stub('../repositories/tripRepository.js', {
  findMemberUserIds: async () => [7, 8], // 8 is in via the trip's group
  findTripMeta: async () => ({ title: 'Durban Trip', currency: 'ZAR' }),
  findSplitShares: async () => savedShares,
});
stub('../repositories/budgetRepository.js', {
  findByTripId: async () => ({ currency: 'ZAR', totalAmount: decimal('1000.00'), categoryLimits: [] }),
});
stub('../repositories/expenseRepository.js', {
  findForTotals: async () => rows,
  createWithSplits: async (data, splits) => {
    const row = { id: String(rows.length + 1), ...data, exchangeRate: data.exchangeRate && decimal(data.exchangeRate), amount: decimal(data.amount), splits: splits.map((s) => ({ ...s, shareAmount: decimal(s.shareAmount) })) };
    rows.push(row);
    return row;
  },
});
stub('../repositories/notificationRepository.js', { createNotification: async (n) => notifications.push(n) });
stub('./ratesService.js', {
  fetchRate: async (base, target) => {
    rateCalls += 1;
    if (rateDown) throw Object.assign(new Error('Exchange rates are unavailable right now.'), { statusCode: 503 });
    assert.deepEqual([base, target], ['USD', 'ZAR']);
    return { rate: 18.2 };
  },
});

const expenseService = require('./expenseService');

(async () => {
  // R500 lunch: same currency, no rate call, 50% used - no warning yet
  let r = await expenseService.createExpense(1, 7, { title: 'Lunch', amount: 500, category: 'FOOD' });
  assert.equal(r.expense.currency, 'ZAR'); // defaults to the trip's currency
  assert.equal(r.expense.exchangeRate, null);
  assert.equal(rateCalls, 0);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.expense.splits.length, 2); // split with the group member too

  // $20 taxi = R364: rate stored, total R864 crosses 80% - both members told once
  r = await expenseService.createExpense(1, 7, { title: 'Taxi', amount: 20, currency: 'usd', category: 'TRANSPORT' });
  assert.equal(r.expense.exchangeRate, 18.2);
  assert.equal(r.expense.amount, 20); // kept as paid
  assert.deepEqual(r.warnings, ['Trip budget: 86% used (R864.00 of R1,000.00)']);
  assert.deepEqual(notifications.map((n) => n.userId), [7, 8]);
  assert.equal(notifications[0].title, 'Budget alert for "Durban Trip"');

  // R50 more: still between 80% and 100% - warning, but no new notification
  r = await expenseService.createExpense(1, 7, { title: 'Coffee', amount: 50, category: 'FOOD' });
  assert.equal(notifications.length, 2);
  assert.equal(r.warnings.length, 1);

  // a saved 70/30 split is used when the request names none; a stale one (wrong members) is ignored
  savedShares = { 7: 70, 8: 30 };
  r = await expenseService.createExpense(1, 7, { title: 'Dinner', amount: 100, category: 'FOOD' });
  assert.deepEqual(r.expense.splits.map((s) => [s.userId, Number(s.shareAmount)]), [[7, 70], [8, 30]]);
  assert.equal(r.expense.splitType, 'PERCENT');
  savedShares = { 7: 50, 9: 50 };
  r = await expenseService.createExpense(1, 7, { title: 'Snacks', amount: 10, category: 'FOOD' });
  assert.equal(r.expense.splitType, 'EQUAL');
  savedShares = null;
  rows.length -= 2;

  // the rate service down: refuse, rather than store a wrong total
  rateDown = true;
  await assert.rejects(expenseService.createExpense(1, 7, { title: 'Shoes', amount: 30, currency: 'USD', category: 'MISC' }), { statusCode: 503 });
  assert.equal(rows.length, 3);

  console.log('expenseService selfcheck: all assertions passed');
})();
