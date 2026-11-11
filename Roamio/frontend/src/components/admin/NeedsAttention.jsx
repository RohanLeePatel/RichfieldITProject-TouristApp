import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { adminUsersQuery, retryUnlessForbidden, safetyQuery, serviceHealthQuery } from "../../api/admin.js";
import { adminReportsQuery } from "../../api/places.js";

// Things an admin should act on, worked out from the same queries the tabs use (so the cache is shared).
// Each item: { key, tab, count, label } - only those with count > 0.
export function useAttention() {
  const opts = { retry: retryUnlessForbidden };
  const health = useQuery({ ...serviceHealthQuery, ...opts });
  const reports = useQuery({ ...adminReportsQuery, ...opts });
  const safety = useQuery({ ...safetyQuery, ...opts });
  const suspended = useQuery({ ...adminUsersQuery({ status: "suspended" }), ...opts });

  const services = Object.entries(health.data?.services ?? {});
  // "not configured" is a setup choice, not an outage
  const down = services.filter(([, s]) => s.status === "down" && !/not configured/.test(s.detail || "")).length;
  const degraded = services.filter(([, s]) => s.status === "degraded").length;
  const flagged = (reports.data?.reports ?? []).filter((r) => r.flagged).length;
  const open = reports.data?.reports?.length ?? 0;
  const staleAdvisories = (safety.data?.advisories ?? []).filter((a) => a.stale).length + (safety.data?.missing?.length ?? 0);

  const items = [
    { key: "down", tab: "health", count: down, tone: "bad", label: `${down} ${down === 1 ? "service is" : "services are"} down` },
    { key: "degraded", tab: "health", count: degraded, tone: "warn", label: `${degraded} ${degraded === 1 ? "service is" : "services are"} slow` },
    { key: "flagged", tab: "reports", count: flagged, tone: "bad", label: `${flagged} ${flagged === 1 ? "place" : "places"} flagged by travellers` },
    { key: "open", tab: "reports", count: open - flagged, tone: "warn", label: `${open - flagged} more ${open - flagged === 1 ? "place report" : "place reports"} open` },
    { key: "safety", tab: "safety", count: staleAdvisories, tone: "warn", label: `${staleAdvisories} safety ${staleAdvisories === 1 ? "advisory is" : "advisories are"} stale or missing` },
    { key: "suspended", tab: "users", count: suspended.data?.total ?? 0, tone: "info", label: `${suspended.data?.total ?? 0} suspended ${suspended.data?.total === 1 ? "account" : "accounts"}` },
  ].filter((item) => item.count > 0);

  const loaded = !health.isPending && !reports.isPending;
  return { items, loaded, byTab: items.reduce((sum, i) => ({ ...sum, [i.tab]: (sum[i.tab] ?? 0) + (i.tone === "info" ? 0 : i.count) }), {}) };
}

export default function NeedsAttention({ attention, onOpenTab }) {
  const { items, loaded } = attention;
  if (!loaded) return null;
  if (items.length === 0) {
    return (
      <p className="admin-attention ok" role="status">
        <CheckCircle2 size={16} aria-hidden="true" /> All clear: services are up and no places need review.
      </p>
    );
  }
  return (
    <ul className="admin-attention" aria-label="Needs attention">
      {items.map((item) => (
        <li key={item.key}>
          <button type="button" className={`admin-attention-chip ${item.tone}`} onClick={() => onOpenTab(item.tab)}>
            <AlertTriangle size={14} aria-hidden="true" /> {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
