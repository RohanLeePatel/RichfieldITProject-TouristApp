import { apiFetch, authedFetch } from "./client";

// Budget + expenses for one trip. Amounts come back as numbers; totals in the
// summary are in the budget currency (each expense converted at the rate
// stored with it).

// { currency, totalBudget, totalSpent, remaining, overBudget, warnings[],
//   expenseCount, categories[], balances[] }
export async function fetchBudgetSummary(tripId) {
  const data = await authedFetch(`/api/trips/${encodeURIComponent(tripId)}/budget/summary`);
  return data.summary;
}

// shares: { userId: percent } for every member adding up to 100, or null for an even split
export function saveSplit(tripId, shares) {
  return authedFetch(`/api/trips/${encodeURIComponent(tripId)}/budget/split`, { method: "PUT", body: JSON.stringify({ shares }) });
}

export async function saveBudget(tripId, { totalAmount, currency }) {
  const data = await authedFetch(`/api/trips/${encodeURIComponent(tripId)}/budget`, {
    method: "PUT",
    body: JSON.stringify({ totalAmount, currency }),
  });
  return data.budget;
}

export function saveCategoryLimit(tripId, category, limitAmount) {
  return authedFetch(`/api/trips/${encodeURIComponent(tripId)}/budget/categories/${encodeURIComponent(category)}`, {
    method: "PUT",
    body: JSON.stringify({ limitAmount }),
  });
}

export async function fetchExpenses(tripId) {
  const data = await authedFetch(`/api/trips/${encodeURIComponent(tripId)}/expenses`);
  return data.expenses || [];
}

// -> { expense, warnings[] }
export function createExpense(tripId, expense) {
  return authedFetch(`/api/trips/${encodeURIComponent(tripId)}/expenses`, { method: "POST", body: JSON.stringify(expense) });
}

export function deleteExpense(tripId, expenseId) {
  return authedFetch(`/api/trips/${encodeURIComponent(tripId)}/expenses/${encodeURIComponent(expenseId)}`, { method: "DELETE" });
}

// a preview only - the server fetches the rate it stores itself
export function fetchRate(base, target) {
  return apiFetch(`/api/rates/${encodeURIComponent(base)}/${encodeURIComponent(target)}`);
}
