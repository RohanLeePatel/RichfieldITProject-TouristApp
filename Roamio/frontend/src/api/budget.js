import { apiFetch, authedFetch } from "./client";

// Budget + expenses for one trip. Amounts come back as numbers; totals in the
// summary are in the budget currency (each expense converted at the rate
// stored with it).

// { currency, totalBudget, totalSpent, remaining, overBudget, warnings[],
//   expenseCount, categories[], balances[] }
export async function fetchBudgetSummary(tripId) {
  const data = await authedFetch(`/api/trips/${tripId}/budget/summary`);
  return data.summary;
}

export async function saveBudget(tripId, { totalAmount, currency }) {
  const data = await authedFetch(`/api/trips/${tripId}/budget`, {
    method: "PUT",
    body: JSON.stringify({ totalAmount, currency }),
  });
  return data.budget;
}

export function saveCategoryLimit(tripId, category, limitAmount) {
  return authedFetch(`/api/trips/${tripId}/budget/categories/${category}`, {
    method: "PUT",
    body: JSON.stringify({ limitAmount }),
  });
}

export async function fetchExpenses(tripId) {
  const data = await authedFetch(`/api/trips/${tripId}/expenses`);
  return data.expenses || [];
}

// -> { expense, warnings[] }
export function createExpense(tripId, expense) {
  return authedFetch(`/api/trips/${tripId}/expenses`, { method: "POST", body: JSON.stringify(expense) });
}

export function deleteExpense(tripId, expenseId) {
  return authedFetch(`/api/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" });
}

// a preview only - the server fetches the rate it stores itself
export function fetchRate(base, target) {
  return apiFetch(`/api/rates/${base}/${target}`);
}
