import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Eye, Timer, UserCheck, Users } from "lucide-react";

import { analyticsOverviewQuery, retryUnlessForbidden } from "../../api/admin.js";

const RANGES = [
  { key: "last7Days", label: "7 days" },
  { key: "last30Days", label: "30 days" },
];

const formatNumber = (value) => new Intl.NumberFormat().format(value ?? 0);

// 95.4 -> "1:35"
function formatDuration(seconds = 0) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// GA4 core metrics: yesterday's active users, plus active users, page views
// and average session length over the picked range.
export default function AnalyticsOverview() {
  const [range, setRange] = useState("last7Days");
  const { data, isPending, error } = useQuery({ ...analyticsOverviewQuery, retry: retryUnlessForbidden });

  const totals = data?.[range];
  const rangeLabel = RANGES.find((r) => r.key === range).label;
  const stats = [
    { label: "Daily active users", hint: "Yesterday", value: formatNumber(data?.dailyActiveUsers), icon: UserCheck, tone: "teal" },
    { label: "Active users", hint: `Last ${rangeLabel}`, value: formatNumber(totals?.activeUsers), icon: Users, tone: "blue" },
    { label: "Page views", hint: `Last ${rangeLabel}`, value: formatNumber(totals?.pageViews), icon: Eye, tone: "purple" },
    { label: "Avg. session", hint: "Minutes : seconds", value: formatDuration(totals?.avgSessionDurationSeconds), icon: Timer, tone: "orange" },
  ];

  return (
    <section className="admin-section" aria-labelledby="admin-analytics-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-analytics-title">
            <BarChart3 size={18} /> Analytics overview
          </h2>
          <p>From Google Analytics 4</p>
        </div>

        <div className="admin-segmented" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={range === r.key ? "active" : ""}
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="admin-card admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>
            {error.status === 503
              ? "Visitor numbers aren't connected yet. Google Analytics still needs to be set up for this site."
              : error.message}
          </span>
        </div>
      ) : (
        <div className="admin-stats">
          {stats.map(({ label, hint, value, icon: Icon, tone }) => (
            <article className="admin-stat" key={label}>
              <div className={`admin-stat-icon ${tone}`}>
                <Icon size={19} />
              </div>
              <div className="admin-stat-info">
                {isPending ? <span className="admin-skeleton" aria-hidden="true" /> : <strong>{value}</strong>}
                <span>{label}</span>
                <small>{hint}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
