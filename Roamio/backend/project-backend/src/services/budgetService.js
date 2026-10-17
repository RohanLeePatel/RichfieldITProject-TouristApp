const budgetRepository = require('../repositories/budgetRepository');
const expenseRepository = require('../repositories/expenseRepository');
const tripRepository = require('../repositories/tripRepository');
const { httpError, assertTripAccess } = require('./tripAccessService');
const { CATEGORIES, parseCategory, parseCurrency } = require('./expenseService');
const { toCents, decimalToCents, centsToDecimalInput, centsToAmount } = require('../utils/money');

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

// Per-member paid vs owed; positive net = the group owes this member
const computeBalances = async (tripId) => {
  const [memberIds, paidRows, owedRows] = await Promise.all([
    tripRepository.findMemberUserIds(tripId),
    expenseRepository.sumPaidGroupedByMember(tripId),
    expenseRepository.sumOwedGroupedByMember(tripId)
  ]);

  const paid = new Map(paidRows.map((r) => [r.paidById, decimalToCents(r._sum.amount)]));
  const owed = new Map(owedRows.map((r) => [r.userId, decimalToCents(r._sum.shareAmount)]));
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
    const currency = body.currency !== undefined ? parseCurrency(body.currency) : undefined;

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

    const [budget, totals, categoryRows, balances] = await Promise.all([
      budgetRepository.findByTripId(tripId),
      expenseRepository.sumByTrip(tripId),
      expenseRepository.sumGroupedByCategory(tripId),
      computeBalances(tripId)
    ]);

    const spentCents = decimalToCents(totals.total);
    const budgetCents = budget ? decimalToCents(budget.totalAmount) : null;
    const spentByCategory = new Map(categoryRows.map((r) => [r.category, {
      cents: decimalToCents(r._sum.amount),
      count: r._count.id
    }]));
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
      expenseCount: totals.count,
      categories,
      balances
    };
  }

  async getBalances(tripId, userId) {
    await assertTripAccess(tripId, userId);
    return computeBalances(tripId);
  }
}

module.exports = new BudgetService();
