const expenseRepository = require('../repositories/expenseRepository');
const budgetRepository = require('../repositories/budgetRepository');
const tripRepository = require('../repositories/tripRepository');
const { httpError, assertTripAccess } = require('./tripAccessService');
const notificationRepository = require('../repositories/notificationRepository');
const { fetchRate } = require('./ratesService');
const { toCents, decimalToCents, centsToDecimalInput, centsToAmount } = require('../utils/money');
const { expenseTotals, crossedThresholds, warningFor } = require('../utils/expenseTotals');

const CATEGORIES = ['TRANSPORT', 'FOOD', 'ACCOMMODATION', 'ACTIVITY', 'MISC'];
const SPLIT_TYPES = ['EQUAL', 'EXACT', 'PERCENT'];

const serializeExpense = (expense) => ({
  ...expense,
  amount: centsToAmount(decimalToCents(expense.amount)),
  exchangeRate: expense.exchangeRate == null ? null : Number(expense.exchangeRate.toString()),
  splits: expense.splits.map((split) => ({
    ...split,
    shareAmount: centsToAmount(decimalToCents(split.shareAmount))
  }))
});

// --- Validation of individual fields (only whitelisted fields ever reach the repository) ---

const parseTitle = (title) => {
  if (typeof title !== 'string' || !title.trim()) throw httpError(400, 'title is required');
  return title.trim();
};

const parseAmountCents = (amount) => {
  const cents = toCents(amount);
  if (cents === null || cents === 0) {
    throw httpError(400, 'amount must be a positive number with at most 2 decimal places');
  }
  return cents;
};

const parseCategory = (category) => {
  const normalized = typeof category === 'string' ? category.toUpperCase() : category;
  if (!CATEGORIES.includes(normalized)) {
    throw httpError(400, `category must be one of ${CATEGORIES.join(', ')}`);
  }
  return normalized;
};

const parseSplitType = (splitType) => {
  const normalized = typeof splitType === 'string' ? splitType.toUpperCase() : splitType;
  if (!SPLIT_TYPES.includes(normalized)) {
    throw httpError(400, `splitType must be one of ${SPLIT_TYPES.join(', ')}`);
  }
  return normalized;
};

const parseDate = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) throw httpError(400, 'date must be a valid date');
  return parsed;
};

const parseCurrency = (currency) => {
  if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) {
    throw httpError(400, 'currency must be a 3-letter ISO code');
  }
  return currency.toUpperCase();
};

const assertMember = (memberIds, userId, label) => {
  if (!Number.isInteger(userId) || !memberIds.includes(userId)) {
    throw httpError(400, `${label} must be a member of this trip`);
  }
};

// --- Split computation (all in integer cents) ---

// Spreads leftover cents one at a time across the first participants so shares always sum to the total
const distributeRemainder = (shares, totalCents) => {
  let remainder = totalCents - shares.reduce((sum, s) => sum + s.cents, 0);
  for (let i = 0; remainder > 0; i = (i + 1) % shares.length, remainder--) shares[i].cents += 1;
  return shares;
};

const computeSplits = (totalCents, splitType, rawSplits, memberIds) => {
  if (rawSplits !== undefined && !Array.isArray(rawSplits)) throw httpError(400, 'splits must be an array');

  const entries = rawSplits ?? [];
  const userIds = entries.map((s) => Number(s?.userId));
  userIds.forEach((id) => assertMember(memberIds, id, 'Every split userId'));
  if (new Set(userIds).size !== userIds.length) throw httpError(400, 'splits contain duplicate userIds');

  let shares;
  if (splitType === 'EQUAL') {
    // Without explicit participants, split across every trip member
    const participants = entries.length ? userIds : memberIds;
    const base = Math.floor(totalCents / participants.length);
    shares = distributeRemainder(participants.map((userId) => ({ userId, cents: base })), totalCents);
  } else {
    if (!entries.length) throw httpError(400, `splits are required for ${splitType} split type`);

    if (splitType === 'EXACT') {
      shares = entries.map((s, i) => {
        const cents = toCents(s.amount);
        if (cents === null) throw httpError(400, 'Each EXACT split needs a valid amount');
        return { userId: userIds[i], cents };
      });
      const sum = shares.reduce((acc, s) => acc + s.cents, 0);
      if (sum !== totalCents) throw httpError(400, 'EXACT split amounts must add up to the expense amount');
    } else {
      const percents = entries.map((s) => Number(s.percent));
      if (percents.some((p) => !Number.isFinite(p) || p < 0)) {
        throw httpError(400, 'Each PERCENT split needs a non-negative percent');
      }
      if (Math.abs(percents.reduce((a, b) => a + b, 0) - 100) > 0.01) {
        throw httpError(400, 'PERCENT splits must add up to 100');
      }
      shares = entries.map((s, i) => ({ userId: userIds[i], cents: Math.floor((totalCents * percents[i]) / 100) }));
      shares = distributeRemainder(shares, totalCents);
    }
  }

  return shares.map((s) => ({ userId: s.userId, shareAmount: centsToDecimalInput(s.cents) }));
};

// --- Currency + budget checks ---

// The currency totals are kept in: the budget's, else the one the wizard saved
// on the trip. null = neither set yet, so nothing is converted.
const referenceCurrency = async (tripId) =>
  (await budgetRepository.findByTripId(tripId))?.currency || (await tripRepository.findTripMeta(tripId)).currency;

// Rate into the reference currency, stored with the expense (null = same currency).
const rateInto = async (currency, reference) =>
  !reference || currency === reference ? null : String((await fetchRate(currency, reference)).rate);

// Warnings for where spend now stands (80% and over), and a notification to
// every trip member the moment it crosses 80% or 100% of the budget or a
// category limit - once per crossing, not on every later expense.
const checkBudget = async (tripId, before, category) => {
  const budget = await budgetRepository.findByTripId(tripId);
  if (!budget) return [];
  const after = expenseTotals(await expenseRepository.findForTotals(tripId));

  const checks = [{ label: 'Trip budget', before: before.totalCents, after: after.totalCents, limit: decimalToCents(budget.totalAmount) }];
  const limit = budget.categoryLimits.find((l) => l.category === category);
  if (limit) {
    checks.push({
      label: `${category} limit`,
      before: before.byCategory.get(category)?.cents || 0,
      after: after.byCategory.get(category)?.cents || 0,
      limit: decimalToCents(limit.limitAmount)
    });
  }

  const warnings = checks.map((c) => warningFor(c.label, c.after, c.limit, budget.currency)).filter(Boolean);
  const crossed = checks.filter((c) => crossedThresholds(c.before, c.after, c.limit).length > 0);
  if (crossed.length) {
    const [memberIds, trip] = await Promise.all([tripRepository.findMemberUserIds(tripId), tripRepository.findTripMeta(tripId)]);
    const title = trip.title ? `Budget alert for "${trip.title}"` : 'Budget alert';
    // a failed notification must not fail the expense that was just saved
    await Promise.all(crossed.flatMap((c) => memberIds.map((userId) =>
      notificationRepository.createNotification({ userId, title, message: warningFor(c.label, c.after, c.limit, budget.currency), type: 'ALERT' })
        .catch(() => null)
    )));
  }
  return warnings;
};

const findExpenseOrThrow = async (expenseId, tripId) => {
  const expense = await expenseRepository.findByIdInTrip(expenseId, tripId);
  if (!expense) throw httpError(404, 'Expense not found');
  return expense;
};

class ExpenseService {
  async createExpense(tripId, userId, body) {
    await assertTripAccess(tripId, userId, { write: true });
    const memberIds = await tripRepository.findMemberUserIds(tripId);

    const amountCents = parseAmountCents(body.amount);
    const category = parseCategory(body.category);
    const splitType = body.splitType === undefined ? 'EQUAL' : parseSplitType(body.splitType);
    const paidById = body.paidById === undefined ? userId : Number(body.paidById);
    assertMember(memberIds, paidById, 'paidById');

    const reference = await referenceCurrency(tripId);
    const currency = body.currency !== undefined ? parseCurrency(body.currency) : reference || 'ZAR';
    const data = {
      tripId,
      title: parseTitle(body.title),
      amount: centsToDecimalInput(amountCents),
      currency,
      exchangeRate: await rateInto(currency, reference),
      category,
      splitType,
      paidById,
      ...(body.date !== undefined && { date: parseDate(body.date) })
    };
    const splits = computeSplits(amountCents, splitType, body.splits, memberIds);

    const before = expenseTotals(await expenseRepository.findForTotals(tripId));
    const expense = await expenseRepository.createWithSplits(data, splits);
    const warnings = await checkBudget(tripId, before, category);
    return { expense: serializeExpense(expense), warnings };
  }

  async listExpenses(tripId, userId, { category } = {}) {
    await assertTripAccess(tripId, userId);
    const filter = category ? { category: parseCategory(category) } : {};
    const expenses = await expenseRepository.findByTripId(tripId, filter);
    return expenses.map(serializeExpense);
  }

  async getExpense(tripId, userId, expenseId) {
    await assertTripAccess(tripId, userId);
    return serializeExpense(await findExpenseOrThrow(expenseId, tripId));
  }

  async updateExpense(tripId, userId, expenseId, body) {
    await assertTripAccess(tripId, userId, { write: true });
    const existing = await findExpenseOrThrow(expenseId, tripId);
    const memberIds = await tripRepository.findMemberUserIds(tripId);

    const data = {};
    if (body.title !== undefined) data.title = parseTitle(body.title);
    if (body.category !== undefined) data.category = parseCategory(body.category);
    if (body.currency !== undefined) {
      data.currency = parseCurrency(body.currency);
      data.exchangeRate = await rateInto(data.currency, await referenceCurrency(tripId));
    }
    if (body.date !== undefined) data.date = parseDate(body.date);
    if (body.paidById !== undefined) {
      data.paidById = Number(body.paidById);
      assertMember(memberIds, data.paidById, 'paidById');
    }

    // Any change to amount / split type / splits re-computes the split rows
    let splits = null;
    if (body.amount !== undefined || body.splitType !== undefined || body.splits !== undefined) {
      const amountCents = body.amount !== undefined ? parseAmountCents(body.amount) : decimalToCents(existing.amount);
      const splitType = body.splitType !== undefined ? parseSplitType(body.splitType) : existing.splitType;
      let rawSplits = body.splits;
      if (rawSplits === undefined) {
        if (splitType !== 'EQUAL') throw httpError(400, `splits are required when changing a ${splitType} expense`);
        rawSplits = existing.splits.map((s) => ({ userId: s.userId })); // keep current participants
      }
      data.amount = centsToDecimalInput(amountCents);
      data.splitType = splitType;
      splits = computeSplits(amountCents, splitType, rawSplits, memberIds);
    }

    if (!Object.keys(data).length) throw httpError(400, 'No updatable fields provided');

    const before = expenseTotals(await expenseRepository.findForTotals(tripId));
    const expense = await expenseRepository.updateWithSplits(expenseId, data, splits);
    const warnings = await checkBudget(tripId, before, expense.category);
    return { expense: serializeExpense(expense), warnings };
  }

  async deleteExpense(tripId, userId, expenseId) {
    await assertTripAccess(tripId, userId, { write: true });
    await findExpenseOrThrow(expenseId, tripId);
    await expenseRepository.delete(expenseId);
  }
}

module.exports = new ExpenseService();
module.exports.CATEGORIES = CATEGORIES;
module.exports.parseCategory = parseCategory;
module.exports.parseCurrency = parseCurrency;
