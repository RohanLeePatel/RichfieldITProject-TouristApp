import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClockAlert, Plane, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

import { retryUnlessForbidden, safetyQuery, startSafetySync } from "../../api/admin.js";
import { number } from "./adminFormat.js";
import { Empty, ErrorCard, Panel, Tile } from "./adminParts.jsx";

// the scale the advisory data uses: 1 (normal) .. 4 (do not travel)
const RISK = { 1: ["online", "Normal"], 2: ["degraded", "Be careful"], 3: ["down", "Reconsider travel"], 4: ["down", "Do not travel"] };

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function RiskPill({ level }) {
  const [tone, label] = RISK[level] ?? ["degraded", `Level ${level}`];
  return (
    <span className={`admin-status-pill ${tone}`}>
      <span className="admin-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

// Travel-safety advisories per country: which are old or missing, and which planned trips
// are going to countries rated 3 or 4. The advisories refresh by themselves every 12 hours.
export default function SafetyReport() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ ...safetyQuery, retry: retryUnlessForbidden });
  const [notice, setNotice] = useState(null); // { tone, text }

  const sync = useMutation({
    mutationFn: startSafetySync,
    onSuccess: () => {
      setNotice({ tone: "ok", text: "Re-check started. It takes a few minutes; reload this tab afterwards to see the new dates." });
      // pick up the fresh dates once the background check has had time to run
      setTimeout(() => queryClient.invalidateQueries({ queryKey: safetyQuery.queryKey }), 60_000);
    },
    onError: (err) => setNotice({ tone: "error", text: err.message }),
  });

  const stale = data?.advisories.filter((a) => a.stale) ?? [];
  const highRisk = data?.advisories.filter((a) => a.riskLevel >= 3) ?? [];
  const openAlerts = data?.openAlerts.reduce((sum, a) => sum + a.count, 0);

  return (
    <section className="admin-section" aria-labelledby="admin-safety-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-safety-title">
            <ShieldAlert size={18} /> Safety advisories
          </h2>
          <p>Travel-risk data for the countries travellers are visiting</p>
        </div>
        <button type="button" className="admin-button" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw size={15} className={sync.isPending ? "admin-spin" : ""} /> Re-check now
        </button>
      </div>

      {notice && (
        <p className={`admin-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            &times;
          </button>
        </p>
      )}

      {error && !data ? (
        <ErrorCard error={error} />
      ) : (
        <>
          {data?.usingMockData && (
            <p className="admin-note">These advisories are sample data, not live ratings. Connect the travel-risk provider before relying on them.</p>
          )}

          <div className="admin-stats">
            <Tile label="Countries tracked" icon={ShieldCheck} tone="blue" value={number(data?.advisories.length)} loading={!data} />
            <Tile label="High risk (3 or 4)" icon={ShieldAlert} tone="orange" value={number(highRisk.length)} loading={!data} />
            <Tile label="Open alerts" icon={AlertTriangle} tone="purple" value={number(openAlerts)} hint="on trips" loading={!data} />
            <Tile label="Trips at risk" icon={Plane} tone="teal" value={number(data?.tripsAtRisk.length)} hint="upcoming, risk 3 or 4" loading={!data} />
          </div>

          <div className="admin-ins-grid">
            <Panel title="Trips heading to high-risk countries" icon={Plane} hint="Planned, confirmed or under way">
              {!data ? (
                <Empty>Loading…</Empty>
              ) : data.tripsAtRisk.length === 0 ? (
                <Empty>No upcoming trip is going to a country rated 3 or 4.</Empty>
              ) : (
                <ul className="admin-ins-features">
                  {data.tripsAtRisk.map((trip) => (
                    <li key={trip.id}>
                      <span>
                        {trip.title} <small>{trip.country}</small>
                      </span>
                      <RiskPill level={trip.riskLevel} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Needs a look" icon={ClockAlert} hint={`Older than ${data?.staleAfterDays ?? 3} days, or no advisory at all`}>
              {!data ? (
                <Empty>Loading…</Empty>
              ) : stale.length === 0 && data.missing.length === 0 ? (
                <Empty>Every advisory is up to date.</Empty>
              ) : (
                <ul className="admin-ins-features">
                  {data.missing.map((country) => (
                    <li key={`missing-${country}`}>
                      <span>
                        {country} <small>no advisory yet</small>
                      </span>
                    </li>
                  ))}
                  {stale.map((a) => (
                    <li key={`stale-${a.country}`}>
                      <span>
                        {a.country} <small>last updated {formatDate(a.lastUpdated)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="All countries" icon={ShieldCheck} hint="Highest risk first">
            {!data ? (
              <Empty>Loading…</Empty>
            ) : data.advisories.length === 0 ? (
              <Empty>No advisories yet. They appear once a trip includes a destination.</Empty>
            ) : (
              <ul className="admin-safety-list">
                {data.advisories.map((a) => (
                  <li key={a.country}>
                    <strong>{a.country}</strong>
                    <span>{a.advisoryLevel}</span>
                    <RiskPill level={a.riskLevel} />
                    <small className={a.stale ? "stale" : ""}>{formatDate(a.lastUpdated)}</small>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </section>
  );
}
