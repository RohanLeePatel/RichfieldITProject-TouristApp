import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, Coins, PiggyBank, Receipt, Tags, Wallet } from "lucide-react";

import { retryUnlessForbidden, spendingQuery } from "../../api/admin.js";
import { number } from "./adminFormat.js";
import { BarList, Delta, Empty, ErrorCard, Panel, RangePicker, Tile } from "./adminParts.jsx";

// 1500.5 ZAR -> "R 1 501" in the viewer's locale; an unknown code is shown as plain text
function money(amount, currency) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${number(Math.round(amount))} ${currency}`;
  }
}

const CATEGORY = { TRANSPORT: "Transport", FOOD: "Food", ACCOMMODATION: "Accommodation", ACTIVITY: "Activities", MISC: "Other" };

// What travellers log: how many expenses, in which currencies and categories, the budgets they set
// and how much of the shared cost is settled. Totals stay in each currency; they are never added across.
export default function SpendingReport() {
  const [days, setDays] = useState(30);
  const { data, error } = useQuery({ ...spendingQuery(days), retry: retryUnlessForbidden });

  return (
    <section className="admin-section" aria-labelledby="admin-spending-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-spending-title">
            <Wallet size={18} /> Budgets and spending
          </h2>
          <p>What travellers record in the expense tracker</p>
        </div>
        <RangePicker days={days} onChange={setDays} />
      </div>

      {error && !data ? (
        <ErrorCard error={error} />
      ) : (
        <>
          <div className="admin-stats">
            <Tile
              label="Expenses logged"
              icon={Receipt}
              tone="blue"
              value={number(data?.expenses.count)}
              loading={!data}
              extra={data && <Delta value={data.expenses.count} previous={data.expenses.previous} />}
            />
            <Tile label="Per trip" icon={Coins} tone="teal" value={data?.expenses.perTrip ?? "—"} hint="expenses on a trip that has any" loading={!data} />
            <Tile label="Currencies used" icon={Wallet} tone="purple" value={number(data?.totals.length)} loading={!data} />
            <Tile
              label="Shared costs settled"
              icon={CheckCheck}
              tone="orange"
              value={data?.settlement.rate == null ? "—" : `${data.settlement.rate}%`}
              hint={data && `${number(data.settlement.settled)} of ${number(data.settlement.total)} shares, all time`}
              loading={!data}
            />
          </div>

          <div className="admin-ins-grid">
            <Panel title="Spend by currency" icon={Coins} hint="Totals are not converted between currencies">
              {!data ? (
                <Empty>Loading…</Empty>
              ) : data.totals.length === 0 ? (
                <Empty>No expenses were logged in this period.</Empty>
              ) : (
                <ul className="admin-ins-features">
                  {data.totals.map((t) => (
                    <li key={t.currency}>
                      <span>
                        {t.currency} <small>{number(t.count)} expenses</small>
                      </span>
                      <strong>{money(t.total, t.currency)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="What it's spent on" icon={Tags} hint="Share of expenses by category">
              <BarList
                items={data?.categories.map((c) => ({ label: CATEGORY[c.label] ?? c.label, count: c.count, note: c.share == null ? "" : `${c.share}%` }))}
                empty="No expenses were logged in this period."
              />
            </Panel>

            <Panel title="Budgets" icon={PiggyBank} hint="Average trip budget, all trips">
              {!data ? (
                <Empty>Loading…</Empty>
              ) : data.budgets.length === 0 ? (
                <Empty>No trip has a budget yet.</Empty>
              ) : (
                <ul className="admin-ins-features">
                  {data.budgets.map((b) => (
                    <li key={b.currency}>
                      <span>
                        {b.currency} <small>{number(b.count)} {b.count === 1 ? "budget" : "budgets"}</small>
                      </span>
                      <strong>{money(b.average, b.currency)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}
