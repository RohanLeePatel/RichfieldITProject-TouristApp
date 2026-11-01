import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Database, HardDrive, Languages, RefreshCw } from "lucide-react";

import { retryUnlessForbidden, serviceHealthQuery } from "../../api/admin.js";
import { formatTime } from "../../utils/format.js";

const SERVICES = [
  { key: "database", name: "Database", sub: "Supabase PostgreSQL", icon: Database },
  { key: "storage", name: "Storage", sub: "Supabase Storage", icon: HardDrive },
  { key: "deepl", name: "DeepL", sub: "Translation API", icon: Languages },
];

const STATUS_LABELS = { online: "Online", degraded: "Degraded", down: "Down" };

// Dot + word, so the state never relies on colour alone
function StatusPill({ status }) {
  const known = STATUS_LABELS[status] ? status : "down";
  return (
    <span className={`admin-status-pill ${known}`}>
      <span className="admin-status-dot" aria-hidden="true" />
      {STATUS_LABELS[known]}
    </span>
  );
}

// Live checks run by the API; refreshed every 30 seconds while the page is open.
export default function ServiceHealthCard() {
  const { data, isPending, error, refetch, isFetching } = useQuery({
    ...serviceHealthQuery,
    retry: retryUnlessForbidden,
  });

  const services = data?.services || {};
  const issues = SERVICES.filter(({ key }) => services[key] && services[key].status !== "online").length;
  const checkedAt = data?.checkedAt ? formatTime(data.checkedAt) : null;

  return (
    <section className="admin-card" aria-labelledby="admin-health-title">
      <div className="admin-card-heading">
        <div>
          <h2 id="admin-health-title">
            <Activity size={18} /> Service health
          </h2>
          <p>{checkedAt ? `Checked ${checkedAt}` : "Checking services…"}</p>
        </div>

        <div className="admin-card-actions">
          {data && (
            <span className={`admin-summary ${issues ? "has-issues" : ""}`}>
              {issues ? `${issues} ${issues === 1 ? "issue" : "issues"}` : "All systems online"}
            </span>
          )}
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Re-check services"
            title="Re-check services"
          >
            <RefreshCw size={16} className={isFetching ? "admin-spin" : ""} />
          </button>
        </div>
      </div>

      {error && !data ? (
        <div className="admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
        </div>
      ) : (
        <ul className="admin-service-list">
          {SERVICES.map(({ key, name, sub, icon: Icon }) => {
            const service = services[key];
            return (
              <li className="admin-service" key={key}>
                <div className="admin-service-icon">
                  <Icon size={18} />
                </div>
                <div className="admin-service-name">
                  <strong>{name}</strong>
                  <span>{sub}</span>
                  {service?.detail && <small>{service.detail}</small>}
                </div>
                {isPending ? (
                  <span className="admin-skeleton admin-skeleton-pill" aria-hidden="true" />
                ) : (
                  <div className="admin-service-status">
                    <StatusPill status={service?.status} />
                    <span className="admin-latency">
                      {service?.latencyMs != null ? `${service.latencyMs} ms` : "—"}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
