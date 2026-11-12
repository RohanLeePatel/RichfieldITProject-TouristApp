import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, LoaderCircle, Plus, Trash2, Wallet } from "lucide-react";
import { useParams } from "react-router-dom";


import { createExpense, deleteExpense, fetchBudgetSummary, fetchExpenses, fetchRate, saveBudget, saveCategoryLimit, saveSplit } from "../api/budget.js";
import { fetchTrip } from "../api/trips.js";
import PageShell from "../components/recommendations/PageShell.jsx";
import { useAuthStore } from "../store/authStore.js";
import { formatMoney } from "../utils/format.js";
import { CURRENCIES } from "./recommendations/constants.js";
import "../styles/trips.css";
import { showToast } from "../store/toastStore.js";

const CATEGORIES = [
  { id: "FOOD", label: "Food & drink", example: "Bunny chow" },
  { id: "TRANSPORT", label: "Transport", example: "Uber to the airport" },
  { id: "ACCOMMODATION", label: "Accommodation", example: "Hotel, 2 nights" },
  { id: "ACTIVITY", label: "Activities", example: "Table Mountain cable car" },
  { id: "MISC", label: "Other", example: "Sunscreen" },
];
const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

const money = formatMoney;
const today = () => new Date().toLocaleDateString("en-CA");

// generous ceiling - anything above is almost certainly a typo
const MAX_AMOUNT = 10_000_000;

// "" when ok, otherwise the message to show; `allowZero` is for limits/budgets
const amountError = (value, label, { allowZero = false } = {}) => {
  const n = Number(value);
  if (value === "" || !Number.isFinite(n)) return `Enter ${label} as a number.`;
  if (allowZero ? n < 0 : n <= 0) return `${label[0].toUpperCase()}${label.slice(1)} must be ${allowZero ? "zero or more" : "more than zero"}.`;
  if (n > MAX_AMOUNT) return `${label[0].toUpperCase()}${label.slice(1)} can't be more than ${MAX_AMOUNT.toLocaleString("en-GB")}.`;
  if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim())) return `Use at most two decimal places for ${label}.`;
  return "";
};

// Moves an ISO date by whole days, in local time, so the date picker's limits don't drift.
const shiftDays = (iso, days) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
};

// Records a purchase in whatever currency it was paid in, and shows what is left of
// the budget in the trip's currency. Every amount is stored with the exchange rate
// the server used at the time, so later rate changes can't rewrite past totals.
// embedded: shown inside the trip's Budget tab, so no page shell of its own.
export default function TripBudget({ embedded = false }) {
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

  // deleted at once, with Undo: the expense is re-created from what the form records
  const removeExpense = async (expense) => {
    if (!(await run(() => deleteExpense(tripId, expense.id)))) return;
    const { title, amount, currency, category, date } = expense;
    showToast(`Deleted "${title}".`, {
      label: "Undo",
      run: () => run(() => createExpense(tripId, { title, amount, currency, category, date })),
    });
  };

  // quick: the action already put its result on screen, so refresh the totals
  // in the background instead of keeping the button busy
  const run = async (action, { quick = false } = {}) => {
    setBusy(true);
    setError("");
    try {
      await action();
      if (quick) load();
      else await load();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
      return false;
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

  const Wrapper = embedded ? Fragment : PageShell;
  const wrapperProps = embedded ? {} : { backTo: `/trips/${tripId}`, backLabel: "Back to the trip", hero };

  return (
    <Wrapper {...wrapperProps}>
      {error && <p className="recommendations-error" role="alert">{error}</p>}
      {!summary ? (
        !error && <p className="wizard-help"><LoaderCircle className="recommendations-spinner" size={16} /> Loading budget...</p>
      ) : (
        <>
          <BudgetOverview
            summary={summary}
            defaultCurrency={budgetCurrency}
            suggested={trip?.budget}
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
                // show it at once; the refresh that follows replaces it with the server's copy
                setExpenses((current) => [result.expense, ...current]);
              }, { quick: true })
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
                    onClick={() => removeExpense(expense)}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="recommendations-results">
            <div className="results-heading">
              <div>
                <h2>Who owes whom</h2>
                <p>Costs are split equally between everyone on the trip unless you set each person&apos;s share below.</p>
              </div>
            </div>
            {summary.balances.some((b) => b.paid > 0 || b.owed > 0) && (
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
            )}

            <SplitShares
              saved={summary.splitShares}
              memberIds={summary.splitMembers}
              names={names}
              busy={busy}
              error={error}
              onSave={(shares) => run(() => saveSplit(tripId, shares))}
            />
          </section>
        </>
      )}
    </Wrapper>
  );
}

// Set once for the whole trip: every new expense is divided by these percentages
// (the server applies them). Off = split evenly, the default. Past expenses keep their split.
function SplitShares({ saved, memberIds, names, busy, error, onSave }) {
  const fromSaved = () => Object.fromEntries(memberIds.map((id) => [id, saved?.[id] != null ? String(saved[id]) : ""]));
  const [precise, setPrecise] = useState(Boolean(saved));
  const [percents, setPercents] = useState(fromSaved);
  const [editing, setEditing] = useState(!saved); // saved shares show read-only until "Change split"
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState(""); // what just happened: saved, reset, or a box was capped
  const used = Math.round(memberIds.reduce((sum, id) => sum + (Number(percents[id]) || 0), 0) * 100) / 100;
  const left = Math.round((100 - used) * 100) / 100;
  const full = Math.abs(left) <= 0.01;
  const label = (id) => names.get(id) || "Member";
  const summaryText = (shares) => memberIds.map((id) => `${label(id)} ${shares?.[id] ?? 0}%`).join(", ");

  const save = async (shares) => {
    setFailed(false);
    setNote("");
    if (await onSave(shares)) {
      setEditing(false);
      setNote(shares ? "Split saved. New expenses will be divided this way." : "Back to splitting evenly. New expenses are divided equally.");
    } else setFailed(true);
  };

  // cap each box so the total can never pass 100
  const setPercent = (id, raw) => {
    setFailed(false);
    setNote("");
    const others = used - (Number(percents[id]) || 0);
    const room = Math.max(0, 100 - others);
    const wanted = Math.max(Number(raw) || 0, 0);
    const value = Math.min(wanted, room);
    if (wanted > room) setNote(`Only ${Math.round(room * 100) / 100}% was left to give, so ${label(id)} is set to ${Math.round(value * 100) / 100}%.`);
    setPercents({ ...percents, [id]: raw === "" ? "" : String(Math.round(value * 100) / 100) });
  };

  const fillEvenly = () => {
    const base = Math.floor((10000 / memberIds.length)) / 100;
    const rest = Math.round((100 - base * memberIds.length) * 100) / 100; // leftover goes to the first person
    setNote("");
    setPercents(Object.fromEntries(memberIds.map((id, i) => [id, String(Math.round((base + (i === 0 ? rest : 0)) * 100) / 100)])));
  };

  const dirty = memberIds.some((id) => (Number(percents[id]) || 0) !== (saved?.[id] ?? 0));

  return (
    <>
      <label className="wizard-field wizard-field-checkbox">
        <input
          type="checkbox"
          checked={precise}
          disabled={busy}
          onChange={(event) => {
            setPrecise(event.target.checked);
            setFailed(false);
            setNote("");
            setEditing(true);
            if (!event.target.checked && saved) save(null); // back to an even split
          }}
        />
        Set each person&apos;s share
      </label>

      {!precise && <p className="wizard-help">{note || "Every new expense is divided equally between everyone on the trip."}</p>}

      {precise && saved && !editing && (
        <>
          <ul className="trip-hub-list">
            {memberIds.map((id) => (
              <li key={id}>
                <strong>{label(id)}</strong>
                <span>{saved[id] ?? 0}% of every new expense</span>
              </li>
            ))}
          </ul>
          <p className="wizard-help" role="status">{note || `Saved: ${summaryText(saved)}.`} Expenses already recorded keep the split they had.</p>
          <button type="button" className="secondary-button" disabled={busy} onClick={() => { setPercents(fromSaved()); setNote(""); setEditing(true); }}>
            Change split
          </button>
        </>
      )}

      {precise && (!saved || editing) && (
        <>
          <p className="wizard-help">
            Choose how much of each new expense every person pays. The shares must add up to 100%. Expenses already recorded keep the split they had.
          </p>
          <div className="field-grid">
            {memberIds.map((id) => (
              <label className="wizard-field" key={id}>
                {label(id)} (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={percents[id] ?? ""}
                  onChange={(event) => setPercent(id, event.target.value)}
                />
              </label>
            ))}
          </div>
          <p className={`wizard-help ${full ? "" : "recommendations-error"}`} role="status">
            {full ? "100% assigned. Ready to save." : `${used}% assigned, ${left}% still to give out.`}
          </p>
          {note && <p className="wizard-help" role="status">{note}</p>}
          <div className="trip-hub-search">
            <button
              type="button"
              className="recommendations-submit"
              disabled={busy || !full || (Boolean(saved) && !dirty)}
              onClick={() => save(Object.fromEntries(memberIds.map((id) => [id, Number(percents[id]) || 0])))}
            >
              {busy && <LoaderCircle className="recommendations-spinner" size={15} />} Save split
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={fillEvenly}>Share equally</button>
            {saved && <button type="button" className="secondary-button" disabled={busy} onClick={() => { setEditing(false); setNote(""); setFailed(false); }}>Cancel</button>}
          </div>
          {!full && <p className="wizard-help">Save unlocks once the shares add up to exactly 100%.</p>}
          {full && saved && !dirty && <p className="wizard-help">No changes yet. Edit a percentage to save a new split.</p>}
          {failed && <p className="recommendations-error" role="alert">Couldn&apos;t save the split{error ? `: ${error}` : "."} Your percentages are still here, so you can try again.</p>}
        </>
      )}
    </>
  );
}

// suggested: the budget planned in the wizard, offered as the starting amount until one is saved here
function BudgetOverview({ summary, defaultCurrency, suggested, busy, onSave }) {
  const [amount, setAmount] = useState(summary.totalBudget ?? suggested ?? "");
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
          noValidate
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
          <button type="submit" className="recommendations-submit" disabled={busy}>
            {busy && <LoaderCircle className="recommendations-spinner" size={15} />} Save budget
          </button>
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
  // `busy` is shared by every form on the page; only this form's own save says "Adding..."
  const [adding, setAdding] = useState(false);

  // allow bookings made up to a year ahead of the trip, nothing after it ends
  const minDate = trip?.startDate ? shiftDays(trip.startDate, -365) : undefined;
  const maxDate = trip?.endDate ? shiftDays(trip.endDate, 0) : undefined;

  // Follow the budget's currency when it changes, so a purchase defaults to it.
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
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          let problem = title.trim() ? amountError(amount, "the amount") : "Say what the purchase was.";
          if (!problem && !/^\d{4}-\d{2}-\d{2}$/.test(date)) problem = "Pick the date of the purchase.";
          else if (!problem && minDate && date < minDate) problem = "That date is more than a year before the trip.";
          else if (!problem && maxDate && date > maxDate) problem = "That date is after the trip ends.";
          setFormError(problem);
          if (problem) return;
          // keep what was typed if the save fails
          setAdding(true);
          if (await onAdd({ title: title.trim(), amount: Number(amount).toFixed(2), currency, category, date })) {
            setTitle("");
            setAmount("");
          }
          setAdding(false);
        }}
      >
        <label className="wizard-field">
          What
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`e.g. ${CATEGORIES.find((c) => c.id === category)?.example}`} required maxLength={100} />
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
        <button type="submit" className="recommendations-submit" disabled={busy}>
          {adding && <LoaderCircle className="recommendations-spinner" size={15} />} {adding ? "Adding..." : "Add"}
        </button>
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
        noValidate
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
