const budgetRepository = require('../repositories/budgetRepository');
const expenseRepository = require('../repositories/expenseRepository');
const tripRepository = require('../repositories/tripRepository');
const { httpError, assertTripAccess } = require('./tripAccessService');
const { CATEGORIES, parseCategory, parseCurrency } = require('./expenseService');
const { toCents, decimalToCents, centsToDecimalInput, centsToAmount } = require('../utils/money');
const { expenseTotals, warningFor } = require('../utils/expenseTotals');

const parseLimitCents = (value, label) => {
  const cents = toCents(value);
  if (cents === null) throw httpError(400, `${label} must be a non-negative number with at most 2 decimal places`);
  return cents;
};

const serializeBudget = (budget) => budget && {
  ...budget,
  totalAmount: centsToAmount(decimalToCents(budget.totalAmount)),
  categoryLimits: budget.categoryLimits.map((limit) => ({
    ...limit,
    limitAmount: centsToAmount(decimalToCents(limit.limitAmount))
  }))
};

const findBudgetOrThrow = async (tripId) => {
  const budget = await budgetRepository.findByTripId(tripId);
  if (!budget) throw httpError(404, 'No budget set for this trip');
  return budget;
};

// Per-member paid vs owed, in the budget currency; positive net = the group owes this member
const computeBalances = async (tripId, totals) => {
  const [memberIds, { paid, owed }] = await Promise.all([
    tripRepository.findMemberUserIds(tripId),
    totals || expenseRepository.findForTotals(tripId).then(expenseTotals)
  ]);
  // Include former members who still appear on expenses
  const userIds = [...new Set([...memberIds, ...paid.keys(), ...owed.keys()])];

  return userIds.map((userId) => {
    const paidCents = paid.get(userId) || 0;
    const owedCents = owed.get(userId) || 0;
    return {
      userId,
      paid: centsToAmount(paidCents),
      owed: centsToAmount(owedCents),
      net: centsToAmount(paidCents - owedCents)
    };
  });
};

class BudgetService {
  async getBudget(tripId, userId) {
    await assertTripAccess(tripId, userId);
    return serializeBudget(await findBudgetOrThrow(tripId));
  }

  // Creates or replaces the trip budget; optional categoryLimits are upserted in the same call
  async setBudget(tripId, userId, body) {
    await assertTripAccess(tripId, userId, { write: true });

    const totalCents = parseLimitCents(body.totalAmount, 'totalAmount');
    // expenses store a rate into the current reference currency, so it can't
    // change under them; a first budget defaults to the trip's own currency
    const existing = await budgetRepository.findByTripId(tripId);
    const reference = existing?.currency || (await tripRepository.findTripMeta(tripId)).currency;
    const currency = body.currency !== undefined ? parseCurrency(body.currency) : reference || undefined;
    if (currency && reference && currency !== reference && (await expenseRepository.sumByTrip(tripId)).count > 0) {
      throw httpError(400, `Expenses are already recorded against ${reference}, so the budget currency can't change.`);
    }

    if (body.categoryLimits !== undefined && !Array.isArray(body.categoryLimits)) {
      throw httpError(400, 'categoryLimits must be an array');
    }
    const limits = (body.categoryLimits || []).map((l) => ({
      category: parseCategory(l?.category),
      cents: parseLimitCents(l?.limitAmount, 'limitAmount')
    }));

    const budget = await budgetRepository.upsert(tripId, {
      totalAmount: centsToDecimalInput(totalCents),
      currency
    });
    for (const limit of limits) {
      await budgetRepository.upsertCategoryLimit(budget.id, limit.category, centsToDecimalInput(limit.cents));
    }
    return serializeBudget(limits.length ? await budgetRepository.findByTripId(tripId) : budget);
  }

  async setCategoryLimit(tripId, userId, rawCategory, body) {
    await assertTripAccess(tripId, userId, { write: true });
    const category = parseCategory(rawCategory);
    const cents = parseLimitCents(body.limitAmount, 'limitAmount');

    const budget = await findBudgetOrThrow(tripId);
    await budgetRepository.upsertCategoryLimit(budget.id, category, centsToDecimalInput(cents));
    return serializeBudget(await budgetRepository.findByTripId(tripId));
  }

  async removeCategoryLimit(tripId, userId, rawCategory) {
    await assertTripAccess(tripId, userId, { write: true });
    const category = parseCategory(rawCategory);

    const budget = await findBudgetOrThrow(tripId);
    const removed = await budgetRepository.deleteCategoryLimit(budget.id, category);
    if (!removed) throw httpError(404, `No limit set for ${category}`);
  }

  async getSummary(tripId, userId) {
    await assertTripAccess(tripId, userId);

    const [budget, totals, splitShares] = await Promise.all([
      budgetRepository.findByTripId(tripId),
      expenseRepository.findForTotals(tripId).then(expenseTotals),
      tripRepository.findSplitShares(tripId)
    ]);
    const balances = await computeBalances(tripId, totals);

    const spentCents = totals.totalCents;
    const budgetCents = budget ? decimalToCents(budget.totalAmount) : null;
    const spentByCategory = totals.byCategory;
    const limitByCategory = new Map((budget?.categoryLimits || []).map((l) => [l.category, decimalToCents(l.limitAmount)]));

    const categories = CATEGORIES
      .filter((c) => spentByCategory.has(c) || limitByCategory.has(c))
      .map((category) => {
        const spent = spentByCategory.get(category)?.cents || 0;
        const limit = limitByCategory.has(category) ? limitByCategory.get(category) : null;
        return {
          category,
          spent: centsToAmount(spent),
          expenseCount: spentByCategory.get(category)?.count || 0,
          limit: limit === null ? null : centsToAmount(limit),
          remaining: limit === null ? null : centsToAmount(limit - spent),
          overLimit: limit !== null && spent > limit
        };
      });

    return {
      currency: budget?.currency ?? null,
      totalBudget: budgetCents === null ? null : centsToAmount(budgetCents),
      totalSpent: centsToAmount(spentCents),
      remaining: budgetCents === null ? null : centsToAmount(budgetCents - spentCents),
      overBudget: budgetCents !== null && spentCents > budgetCents,
      // the 80% / over-budget lines the trip hub and dashboard show
      warnings: budget
        ? [
            warningFor('Trip budget', spentCents, budgetCents, budget.currency),
            ...categories.filter((c) => c.limit !== null).map((c) =>
              warningFor(`${c.category} limit`, Math.round(c.spent * 100), Math.round(c.limit * 100), budget.currency))
          ].filter(Boolean)
        : [],
      expenseCount: totals.count,
      categories,
      balances,
      splitShares, // { userId: percent } or null = even
      splitMembers: await tripRepository.findMemberUserIds(tripId) // who the percentages must cover
    };
  }

  // Saves how new expenses are split: shares = { userId: percent } for every member
  // adding up to 100, or null to go back to an even split.
  async setSplit(tripId, userId, { shares } = {}) {
    await assertTripAccess(tripId, userId, { write: true });
    if (shares === null || shares === undefined) {
      await tripRepository.setSplitShares(tripId, {});
      return null;
    }
    if (typeof shares !== 'object' || Array.isArray(shares)) throw httpError(400, 'shares must be an object of userId to percent');
    const memberIds = await tripRepository.findMemberUserIds(tripId);
    const ids = Object.keys(shares).map(Number);
    if (ids.length !== memberIds.length || !memberIds.every((id) => ids.includes(id))) {
      throw httpError(400, 'shares must include every trip member');
    }
    const clean = {};
    for (const id of memberIds) {
      const percent = Number(shares[id]);
      if (shares[id] === '' || !Number.isFinite(percent) || percent < 0 || percent > 100) throw httpError(400, 'Each share must be a percent from 0 to 100');
      clean[id] = Math.round(percent * 100) / 100;
    }
    if (Math.abs(Object.values(clean).reduce((a, b) => a + b, 0) - 100) > 0.01) throw httpError(400, 'Shares must add up to 100%');
    await tripRepository.setSplitShares(tripId, clean);
    return clean;
  }

  async getBalances(tripId, userId) {
    await assertTripAccess(tripId, userId);
    return computeBalances(tripId);
  }
}

module.exports = new BudgetService();
