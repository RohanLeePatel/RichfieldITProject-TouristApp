// Trip spend in the budget currency. Each expense keeps the amount it was paid
// in; exchangeRate (null = 1) converts it. Postgres can't sum across rates in
// one aggregate through Prisma, so totals are done here over the trip's rows -
// a trip has tens of expenses, not thousands. If a trip ever grows to thousands of
// rows, move these sums into a SQL view.
const { decimalToCents } = require('./money');

const rateOf = (expense) => (expense.exchangeRate == null ? 1 : Number(expense.exchangeRate.toString()));
const convert = (cents, expense) => Math.round(cents * rateOf(expense));

// expenses: [{ amount, exchangeRate, category, paidById, splits: [{ userId, shareAmount }] }]
function expenseTotals(expenses) {
  const byCategory = new Map(); // category -> { cents, count }
  const paid = new Map(); // userId -> cents
  const owed = new Map(); // userId -> cents
  let totalCents = 0;

  for (const expense of expenses) {
    const cents = convert(decimalToCents(expense.amount), expense);
    totalCents += cents;
    const category = byCategory.get(expense.category) || { cents: 0, count: 0 };
    byCategory.set(expense.category, { cents: category.cents + cents, count: category.count + 1 });
    paid.set(expense.paidById, (paid.get(expense.paidById) || 0) + cents);
    for (const split of expense.splits || []) {
      owed.set(split.userId, (owed.get(split.userId) || 0) + convert(decimalToCents(split.shareAmount), expense));
    }
  }
  return { totalCents, count: expenses.length, byCategory, paid, owed };
}

const THRESHOLDS = [0.8, 1];

// Which of 80% / 100% of `limitCents` the spend went past with this change.
function crossedThresholds(beforeCents, afterCents, limitCents) {
  if (!(limitCents > 0)) return [];
  return THRESHOLDS.filter((t) => beforeCents < t * limitCents && afterCents >= t * limitCents);
}

// The warning for where spend stands now against a limit, or null under 80%.
function warningFor(label, spentCents, limitCents, currency) {
  if (!(limitCents > 0)) return null;
  // same format as the budget page (en-ZA: "1 727,76 ZAR")
  const amount = (cents) => `${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  if (spentCents > limitCents) return `${label} exceeded by ${amount(spentCents - limitCents)}`;
  if (spentCents >= 0.8 * limitCents) {
    return `${label}: ${Math.floor((spentCents / limitCents) * 100)}% used (${amount(spentCents)} of ${amount(limitCents)})`;
  }
  return null;
}

module.exports = { expenseTotals, crossedThresholds, warningFor };
