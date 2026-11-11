import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from "lucide-react";

import { adminAuditQuery, AUDIT_PAGE_SIZE, retryUnlessForbidden } from "../../api/admin.js";

// what each logged action reads as; anything new falls back to its code in lower case
const ACTIONS = {
  ADMIN_SUSPEND_USER: "Suspended an account",
  ADMIN_REACTIVATE_USER: "Reactivated an account",
  ADMIN_SIGN_OUT_USER: "Signed a user out of every device",
  ADMIN_DESTINATION_ADD: "Added a destination",
  ADMIN_DESTINATION_EDIT: "Edited a destination",
  ADMIN_DESTINATION_DELETE: "Deleted a destination",
  ADMIN_DESTINATIONS_SHOW: "Showed destinations in recommendations",
  ADMIN_DESTINATIONS_HIDE: "Hid destinations from recommendations",
  ADMIN_SAFETY_SYNC: "Re-checked safety advisories",
};

const label = (action) => ACTIONS[action] ?? action.replace(/^ADMIN_/, "").replace(/_/g, " ").toLowerCase();

// Who the action was done to or on: a person's name, else the details the admin screen recorded
function subject({ target, details }) {
  if (target.type === "USER") return target.name ?? `User #${target.id} (no longer exists)`;
  return details && details !== "admin dashboard" ? details : "";
}

// Everything admins changed from this dashboard, newest first. Read-only.
export default function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch, isFetching } = useQuery({ ...adminAuditQuery(page), retry: retryUnlessForbidden });
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  return (
    <section className="admin-card admin-audit" aria-labelledby="admin-audit-title">
      <div className="admin-card-heading">
        <div>
          <h2 id="admin-audit-title">
            <ClipboardList size={18} /> Audit log
          </h2>
          <p>{data ? `${total} admin ${total === 1 ? "action" : "actions"} recorded` : "Loading…"}</p>
        </div>
        <button type="button" className="admin-icon-button" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh audit log" title="Refresh">
          <RefreshCw size={16} className={isFetching ? "admin-spin" : ""} />
        </button>
      </div>

      {error && !data ? (
        <div className="admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
        </div>
      ) : isPending ? (
        <p className="admin-user-empty">Loading…</p>
      ) : data.entries.length === 0 ? (
        <p className="admin-user-empty">Nothing has been changed from the admin dashboard yet.</p>
      ) : (
        <ul className="admin-audit-list">
          {data.entries.map((entry) => (
            <li key={entry.id}>
              <div className="admin-audit-what">
                <strong>{label(entry.action)}</strong>
                {subject(entry) && <span>{subject(entry)}</span>}
              </div>
              <span className="admin-audit-who">by {entry.admin.name}</span>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      )}

      {total > AUDIT_PAGE_SIZE && (
        <nav className="admin-pager" aria-label="Audit log pages">
          <button type="button" className="admin-icon-button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || isFetching} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button type="button" className="admin-icon-button" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount || isFetching} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </section>
  );
}
