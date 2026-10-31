import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, Plus, Trash2, Wallet } from "lucide-react";
import { useParams } from "react-router-dom";

import { createExpense, deleteExpense, fetchBudgetSummary, fetchExpenses, fetchRate, saveBudget, saveCategoryLimit } from "../api/budget.js";
import { fetchTrip } from "../api/trips.js";
import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";
import { CURRENCIES } from "./recommendations/constants.js";
import "../styles/trips.css";

const CATEGORIES = [
  { id: "FOOD", label: "Food & drink" },
  { id: "TRANSPORT", label: "Transport" },
  { id: "ACCOMMODATION", label: "Accommodation" },
  { id: "ACTIVITY", label: "Activities" },
  { id: "MISC", label: "Other" },
];
const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

const money = (amount, currency) =>
  `${Number(amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ""}`.trim();
const today = () => new Date().toLocaleDateString("en-CA");

// generous ceiling - anything above is almost certainly a typo
const MAX_AMOUNT = 10_000_000;

// "" when ok, otherwise the message to show; `allowZero` is for limits/budgets
const amountError = (value, label, { allowZero = false } = {}) => {
  const n = Number(value);
  if (value === "" || !Number.isFinite(n)) return `Enter ${label} as a number.`;
  if (allowZero ? n < 0 : n <= 0) return `${label[0].toUpperCase()}${label.slice(1)} must be ${allowZero ? "zero or more" : "more than zero"}.`;
  if (n > MAX_AMOUNT) return `${label[0].toUpperCase()}${label.slice(1)} can't be more than ${MAX_AMOUNT.toLocaleString("en-ZA")}.`;
  if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) return `Use at most two decimal places for ${label}.`;
  return "";
};

const shiftDays = (iso, days) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

// Durban tasks 7 and 8: record a purchase in whatever currency it was paid in,
// and see what's left of the budget in the trip's currency.
export default function TripBudget() {
  const { tripId } = useParams();
  const me = useAuthStore((state) => state.user);
  const [trip, setTrip] = useState(null);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([fetchTrip(tripId), fetchBudgetSummary(tripId), fetchExpenses(tripId)])
      .then(([tripData, summaryData, expenseData]) => {
        setTrip(tripData);
        setSummary(summaryData);
        setExpenses(expenseData);
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : "Could not load the budget."));

  useEffect(() => {
    load();
  }, [tripId]); // eslint-disable-line react-hooks/exhaustive-deps

  // names for balances: trip members plus anyone who paid or shared a cost
  const names = useMemo(() => {
    const map = new Map();
    (trip?.members || []).forEach((m) => m.user && map.set(m.user.id, m.user.fullName));
    expenses.forEach((e) => {
      if (e.paidBy) map.set(e.paidBy.id, e.paidBy.fullName);
      e.splits.forEach((s) => s.user && map.set(s.user.id, s.user.fullName));
    });
    if (me?.id) map.set(me.id, "You");
    return map;
  }, [trip, expenses, me]);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const budgetCurrency = summary?.currency || trip?.currency || "ZAR";

  const hero = trip ? (
    <>
      <p className="recommendations-eyebrow"><Wallet size={15} /> Budget</p>
      <h1>{trip.title}</h1>
      <p>Record what you spend, in any currency. Totals are in {budgetCurrency}.</p>
    </>
  ) : null;

  return (
    <PageShell backTo={`/trips/${tripId}`} backLabel="Back to the trip" hero={hero}>
      {error && <p className="recommendations-error" role="alert">{error}</p>}
      {!summary ? (
        !error && <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Loading budget...</p>
      ) : (
        <>
          <BudgetOverview
            summary={summary}
            defaultCurrency={budgetCurrency}
            busy={busy}
            onSave={(totalAmount, currency) => run(() => saveBudget(tripId, { totalAmount, currency }))}
          />

          {[...summary.warnings, ...notice].length > 0 && (
            <ul className="budget-warnings" role="status">
              {[...new Set([...summary.warnings, ...notice])].map((text) => (
                <li key={text}><AlertTriangle size={15} /> {text}</li>
              ))}
            </ul>
          )}

          <ExpenseForm
            trip={trip}
            budgetCurrency={budgetCurrency}
            busy={busy}
            onAdd={(expense) =>
              run(async () => {
                const result = await createExpense(tripId, expense);
                setNotice(result.warnings || []);
              })
            }
          />

          {summary.totalBudget !== null && (
            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>By category</h2>
                  <p>Optional limits warn you at 80% and when you go over.</p>
                </div>
              </div>
              <ul className="budget-categories">
                {CATEGORIES.map((category) => {
                  const row = summary.categories.find((c) => c.category === category.id);
                  return (
                    <CategoryRow
                      key={category.id}
                      label={category.label}
                      row={row}
                      currency={budgetCurrency}
                      totalBudget={summary.totalBudget}
                      busy={busy}
                      onLimit={(limit) => run(() => saveCategoryLimit(tripId, category.id, limit))}
                    />
                  );
                })}
              </ul>
            </section>
          )}

          <section className="recommendations-results">
            <div className="results-heading">
              <div>
                <h2>Expenses</h2>
                <p>{expenses.length === 0 ? "Nothing recorded yet." : `${expenses.length} recorded, newest first.`}</p>
              </div>
            </div>
            {expenses.length === 0 && (
              <div className="results-empty">
                <h3>No expenses yet.</h3>
                <p>Add what you spend, like flights, food and tickets. Roamio tracks it against your budget and warns you before you go over.</p>
              </div>
            )}
            <ul className="trip-hub-list budget-expenses">
              {expenses.map((expense) => (
                <li key={expense.id}>
                  <strong>
                    {expense.title} · {money(expense.amount, expense.currency)}
                    {expense.exchangeRate && ` ≈ ${money(expense.amount * expense.exchangeRate, budgetCurrency)}`}
                  </strong>
                  <span>
                    {categoryLabel(expense.category)} · paid by {names.get(expense.paidById) || "a member"} ·{" "}
                    {new Date(expense.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {expense.exchangeRate && ` · at ${expense.exchangeRate} ${budgetCurrency}/${expense.currency}`}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    aria-label={`Delete ${expense.title}`}
                    onClick={() => window.confirm(`Delete "${expense.title}"?`) && run(() => deleteExpense(tripId, expense.id))}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {summary.balances.some((b) => b.paid > 0 || b.owed > 0) && (
            <section className="recommendations-results">
              <div className="results-heading">
                <div>
                  <h2>Who owes whom</h2>
                  <p>Costs are split equally between everyone on the trip.</p>
                </div>
              </div>
              <ul className="trip-hub-list">
                {summary.balances.map((b) => (
                  <li key={b.userId}>
                    <strong>{names.get(b.userId) || "Member"}</strong>
                    <span>
                      paid {money(b.paid, budgetCurrency)}, share {money(b.owed, budgetCurrency)} -{" "}
                      {b.net > 0 ? `is owed ${money(b.net, budgetCurrency)}` : b.net < 0 ? `owes ${money(-b.net, budgetCurrency)}` : "settled"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}

function BudgetOverview({ summary, defaultCurrency, busy, onSave }) {
  const [amount, setAmount] = useState(summary.totalBudget ?? "");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [editing, setEditing] = useState(summary.totalBudget === null);
  const [formError, setFormError] = useState("");
  const percent = summary.totalBudget ? Math.min(100, Math.round((summary.totalSpent / summary.totalBudget) * 100)) : 0;

  return (
    <section className="recommendations-results">
      {summary.totalBudget !== null && !editing ? (
        <>
          <div className="results-heading">
            <div>
              <h2>{money(summary.remaining, summary.currency)} left</h2>
              <p>{money(summary.totalSpent, summary.currency)} spent of {money(summary.totalBudget, summary.currency)}</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setEditing(true)}>Change budget</button>
          </div>
          <div className={`budget-bar ${summary.overBudget ? "over" : percent >= 80 ? "near" : ""}`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${percent}%` }} />
          </div>
        </>
      ) : (
        <form
          className="trip-hub-search"
          onSubmit={(event) => {
            event.preventDefault();
            const problem = amountError(amount, "the trip budget");
            setFormError(problem);
            if (problem) return;
            onSave(Number(amount).toFixed(2), currency);
            setEditing(false);
          }}
        >
          <label className="wizard-field">
            Trip budget
            <input type="number" min="0.01" max={MAX_AMOUNT} step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="wizard-field">
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {[...new Set([defaultCurrency, ...CURRENCIES])].map((code) => <option key={code}>{code}</option>)}
            </select>
          </label>
          <button type="submit" className="recommendations-submit" disabled={busy}>Save budget</button>
        </form>
      )}
      {formError && editing && <p className="recommendations-error" role="alert">{formError}</p>}
    </section>
  );
}

function ExpenseForm({ trip, budgetCurrency, busy, onAdd }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(budgetCurrency);
  const [category, setCategory] = useState("FOOD");
  const [date, setDate] = useState(today);
  const [preview, setPreview] = useState("");
  const [formError, setFormError] = useState("");

  // allow bookings made up to a year ahead of the trip, nothing after it ends
  const minDate = trip?.startDate ? shiftDays(trip.startDate, -365) : undefined;
  const maxDate = trip?.endDate ? shiftDays(trip.endDate, 0) : undefined;

  useEffect(() => setCurrency(budgetCurrency), [budgetCurrency]);

  // "≈ R364.00" while typing a foreign amount; the saved rate is the server's
  useEffect(() => {
    setPreview("");
    if (!amount || currency === budgetCurrency) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      fetchRate(currency, budgetCurrency)
        .then((rate) => active && setPreview(`≈ ${money(Number(amount) * rate.rate, budgetCurrency)}`))
        .catch(() => active && setPreview("Exchange rate unavailable - try again shortly"));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [amount, currency, budgetCurrency]);

  return (
    <section className="recommendations-results">
      <div className="results-heading">
        <div>
          <h2><Plus size={18} /> Record a purchase</h2>
          <p>Enter it as you paid it - it&apos;s converted to {budgetCurrency} for the totals.</p>
        </div>
      </div>
      <form
        className="trip-hub-search"
        onSubmit={(event) => {
          event.preventDefault();
          let problem = "";
          if (!title.trim()) problem = "Say what the purchase was.";
          else problem = amountError(amount, "the amount");
          if (!problem && !/^\d{4}-\d{2}-\d{2}$/.test(date)) problem = "Pick the date of the purchase.";
          else if (!problem && minDate && date < minDate) problem = "That date is more than a year before the trip.";
          else if (!problem && maxDate && date > maxDate) problem = "That date is after the trip ends.";
          setFormError(problem);
          if (problem) return;
          onAdd({ title: title.trim(), amount: Number(amount).toFixed(2), currency, category, date });
          setTitle("");
          setAmount("");
        }}
      >
        <label className="wizard-field">
          What
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Bunny chow" required maxLength={100} />
        </label>
        <label className="wizard-field">
          Amount
          <input type="number" min="0.01" max={MAX_AMOUNT} step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </label>
        <label className="wizard-field">
          Paid in
          <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {[...new Set([budgetCurrency, ...CURRENCIES])].map((code) => <option key={code}>{code}</option>)}
          </select>
        </label>
        <label className="wizard-field">
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="wizard-field">
          Date
          <input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <button type="submit" className="recommendations-submit" disabled={busy}>Add</button>
      </form>
      {formError && <p className="recommendations-error" role="alert">{formError}</p>}
      {preview && <p className="wizard-help">{preview}</p>}
    </section>
  );
}

function CategoryRow({ label, row, currency, totalBudget, busy, onLimit }) {
  const [limit, setLimit] = useState(row?.limit ?? "");
  const [formError, setFormError] = useState("");
  const spent = row?.spent || 0;
  return (
    <li className={row?.overLimit ? "over" : ""}>
      <span>{label}</span>
      <span>{money(spent, currency)}{row?.limit != null && ` of ${money(row.limit, currency)}`}</span>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          let problem = amountError(limit, `the ${label} limit`, { allowZero: true });
          if (!problem && totalBudget != null && Number(limit) > Number(totalBudget)) {
            problem = `The ${label} limit can't be more than the whole trip budget (${money(totalBudget, currency)}).`;
          }
          setFormError(problem);
          if (problem) return;
          onLimit(Number(limit).toFixed(2));
        }}
      >
        <input type="number" min="0" max={totalBudget ?? MAX_AMOUNT} step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="No limit" aria-label={`${label} limit`} />
        <button type="submit" className="secondary-button" disabled={busy || limit === ""}>Set</button>
      </form>
      {formError && <p className="recommendations-error" role="alert">{formError}</p>}
    </li>
  );
}
