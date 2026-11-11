import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Globe2, LayoutDashboard, MapPin, Route, UserPlus, UserCheck, Users } from "lucide-react";

import { adminInsightsQuery, retryUnlessForbidden } from "../../api/admin.js";
import { number } from "./adminFormat.js";
import { Delta, Empty, Panel } from "./adminParts.jsx";

const RANGES = [7, 30, 90];
const SPOTS = [
  { key: "cities", label: "Cities" },
  { key: "countries", label: "Countries" },
  { key: "places", label: "Places" },
];

// A tiny line of the daily values; the numbers are in the label for screen readers
function Sparkline({ series, label }) {
  const max = Math.max(1, ...series.map((p) => p.value));
  const step = series.length > 1 ? 120 / (series.length - 1) : 0;
  const points = series.map((p, i) => `${(i * step).toFixed(1)},${(30 - (p.value / max) * 28).toFixed(1)}`).join(" ");
  return (
    <svg className="admin-ins-spark" viewBox="0 0 120 32" preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({ label, icon: Icon, tone, metric, loading }) {
  return (
    <article className="admin-stat admin-ins-kpi">
      <div className="admin-ins-kpi-head">
        <div className={`admin-stat-icon ${tone}`}>
          <Icon size={19} />
        </div>
        {metric && <Delta value={metric.value} previous={metric.previous} />}
      </div>
      <div className="admin-stat-info">
        {loading ? <span className="admin-skeleton" aria-hidden="true" /> : <strong>{number(metric?.value)}</strong>}
        <span>{label}</span>
      </div>
      {metric?.series.length > 0 && <Sparkline series={metric.series} label={`${label}, one point per day`} />}
    </article>
  );
}

function TopList({ items }) {
  if (!items?.length) return <Empty>No trips have picked a destination in this period yet.</Empty>;
  const max = Math.max(...items.map((i) => i.count));
  return (
    <ol className="admin-ins-bars">
      {items.map((item, index) => (
        <li key={`${item.label}-${item.sub}`}>
          <span className="admin-ins-rank">{index + 1}</span>
          <div className="admin-ins-bar-main">
            <div className="admin-ins-bar-text">
              <strong>{item.label}</strong>
              {item.sub && <span>{item.sub}</span>}
            </div>
            <div className="admin-ins-track" aria-hidden="true">
              <span style={{ width: `${(item.count / max) * 100}%` }} />
            </div>
          </div>
          <span className="admin-ins-count">{number(item.count)}</span>
          <Delta value={item.count} previous={item.previous} />
        </li>
      ))}
    </ol>
  );
}

function Funnel({ steps }) {
  const top = steps[0]?.count || 0;
  if (!top) return <Empty>Nobody signed up in this period.</Empty>;
  return (
    <ol className="admin-ins-funnel">
      {steps.map((step, i) => (
        <li key={step.key}>
          <div className="admin-ins-funnel-text">
            <span>{step.label}</span>
            <strong>
              {number(step.count)}
              {i > 0 && <small> {steps[i - 1].count ? Math.round((step.count / steps[i - 1].count) * 100) : 0}% of previous step</small>}
            </strong>
          </div>
          <div className="admin-ins-track" aria-hidden="true">
            <span style={{ width: `${(step.count / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

// What people do in the app, from Roamio's own tables (Google Analytics only sees page views).
// The date range at the top applies to everything on this tab.
export default function OverviewInsights() {
  const [days, setDays] = useState(30);
  const [spot, setSpot] = useState("cities");
  const { data, isPending, error, isFetching } = useQuery({ ...adminInsightsQuery(days), retry: retryUnlessForbidden });

  const kpis = data?.kpis;
  const loading = isPending;

  return (
    <section className="admin-section" aria-labelledby="admin-insights-title" aria-busy={isFetching}>
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-insights-title">
            <LayoutDashboard size={18} /> Overview
          </h2>
          <p>What people do in Roamio, compared with the {days} days before</p>
        </div>

        <div className="admin-segmented" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button key={range} type="button" className={days === range ? "active" : ""} aria-pressed={days === range} onClick={() => setDays(range)}>
              {range} days
            </button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <div className="admin-card admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
        </div>
      ) : (
        <>
          <div className="admin-stats">
            <Kpi label="Total users" icon={Users} tone="blue" metric={kpis?.totalUsers} loading={loading} />
            <Kpi label="New users" icon={UserPlus} tone="teal" metric={kpis?.newUsers} loading={loading} />
            <Kpi label="Active users" icon={UserCheck} tone="purple" metric={kpis?.activeUsers} loading={loading} />
            <Kpi label="Trips planned" icon={Route} tone="orange" metric={kpis?.trips} loading={loading} />
          </div>

          <div className="admin-ins-grid">
            <Panel
              title="Where users are going"
              icon={Globe2}
              hint="Trips that added each destination"
              actions={
                <div className="admin-segmented" role="group" aria-label="Group destinations by">
                  {SPOTS.map(({ key, label }) => (
                    <button key={key} type="button" className={spot === key ? "active" : ""} aria-pressed={spot === key} onClick={() => setSpot(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              {loading ? <Empty>Loading…</Empty> : <TopList items={data.topDestinations[spot]} />}
            </Panel>

            <Panel title="Sign-up funnel" icon={MapPin} hint="How far this period's new users got">
              {loading ? <Empty>Loading…</Empty> : <Funnel steps={data.funnel} />}
              {data && (
                <p className="admin-ins-foot">
                  {data.retention.rate == null
                    ? "No new users to measure returns for."
                    : `${data.retention.rate}% of new users (${number(data.retention.returned)} of ${number(data.retention.newUsers)}) signed in again on a later day.`}
                </p>
              )}
            </Panel>

            <Panel title="Feature use" icon={LayoutDashboard} hint="Things created in this period">
              {loading ? (
                <Empty>Loading…</Empty>
              ) : (
                <ul className="admin-ins-features">
                  {data.features.map((f) => (
                    <li key={f.key}>
                      <span>{f.label}</span>
                      <strong>{number(f.count)}</strong>
                      <Delta value={f.count} previous={f.previous} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Groups and invitations" icon={Users} hint="How people travel together">
              {loading ? (
                <Empty>Loading…</Empty>
              ) : (
                <dl className="admin-ins-facts">
                  <div>
                    <dt>Groups created</dt>
                    <dd>{number(data.collaboration.groups)}</dd>
                  </div>
                  <div>
                    <dt>Average group size</dt>
                    <dd>{data.collaboration.avgGroupSize ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Invitations sent</dt>
                    <dd>{number(data.collaboration.invitesSent)}</dd>
                  </div>
                  <div>
                    <dt>Invitations accepted</dt>
                    <dd>
                      {number(data.collaboration.invitesAccepted)}
                      {data.collaboration.acceptRate != null && <small> ({data.collaboration.acceptRate}%)</small>}
                    </dd>
                  </div>
                </dl>
              )}
            </Panel>
          </div>
        </>
      )}
    </section>
  );
}
