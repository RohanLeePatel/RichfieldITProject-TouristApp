import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { change, number, RANGES } from "./adminFormat.js";

// Small pieces the admin screens share.

export function Delta({ value, previous }) {
  const d = change(value, previous);
  if (!d) return null;
  const Icon = d.tone === "up" ? ArrowUpRight : d.tone === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`admin-ins-delta ${d.tone}`} title={`${number(previous)} in the period before`}>
      <Icon size={13} aria-hidden="true" />
      {d.text}
    </span>
  );
}

export function Panel({ title, icon: Icon, hint, actions, children }) {
  return (
    <section className="admin-card admin-ins-panel">
      <div className="admin-card-heading">
        <div>
          <h3>
            <Icon size={17} /> {title}
          </h3>
          {hint && <p>{hint}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <p className="admin-user-empty">{children}</p>;
}

export function RangePicker({ days, onChange }) {
  return (
    <div className="admin-segmented" role="group" aria-label="Date range">
      {RANGES.map((range) => (
        <button key={range} type="button" className={days === range ? "active" : ""} aria-pressed={days === range} onClick={() => onChange(range)}>
          {range} days
        </button>
      ))}
    </div>
  );
}

// One stat tile: icon, number and a label
export function Tile({ label, value, hint, icon: Icon, tone, loading, extra }) {
  return (
    <article className="admin-stat">
      <div className={`admin-stat-icon ${tone}`}>
        <Icon size={19} />
      </div>
      <div className="admin-stat-info">
        {loading ? <span className="admin-skeleton" aria-hidden="true" /> : <strong>{value}</strong>}
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      {extra}
    </article>
  );
}

// Labelled bars, longest first. Each item is { label, count, note? }; format shows the number.
export function BarList({ items, format = number, empty = "Nothing to show for this period." }) {
  if (!items?.length) return <Empty>{empty}</Empty>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ol className="admin-ins-bars plain">
      {items.map((item) => (
        <li key={item.label}>
          <div className="admin-ins-bar-main">
            <div className="admin-ins-bar-text">
              <strong>{item.label}</strong>
              {item.note && <span>{item.note}</span>}
            </div>
            <div className="admin-ins-track" aria-hidden="true">
              <span style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
          <span className="admin-ins-count">{format(item.count)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ErrorCard({ error }) {
  return (
    <div className="admin-card admin-error" role="alert">
      <span>{error.message}</span>
    </div>
  );
}
