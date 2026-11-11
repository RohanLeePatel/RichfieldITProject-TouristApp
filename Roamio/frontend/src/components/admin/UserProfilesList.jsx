import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Download, LogOut, RefreshCw, Search, ShieldAlert, UserCheck, Users } from "lucide-react";

import {
  adminUserQuery,
  bulkUsers,
  adminUsersQuery,
  exportUsersCsv,
  retryUnlessForbidden,
  setUserActive,
  signOutUser,
  USERS_PAGE_SIZE,
} from "../../api/admin.js";
import { downloadText } from "./adminFormat.js";

const SKELETON_ROWS = 5;

const STATUSES = [
  { value: "", label: "All users" },
  { value: "active", label: "Active" },
  { value: "unverified", label: "Unverified" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Inactive 30+ days" },
  { value: "no_trips", label: "Never made a trip" },
];

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function formatLastLogin(iso) {
  if (!iso) return "Never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : formatDate(iso);
}

const deviceName = (d) => [d.browser, d.os].filter(Boolean).join(" on ") || d.deviceType;

// A person in full, with the actions an owner needs: suspend or reactivate, and sign out every device.
function UserDetail({ id, onChanged, onOpenAudit }) {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({ ...adminUserQuery(id), retry: retryUnlessForbidden });
  const [message, setMessage] = useState(null); // { tone: "ok" | "error", text }

  const done = (text) => {
    queryClient.invalidateQueries({ queryKey: ["admin", "user", id] });
    onChanged();
    setMessage({ tone: "ok", text });
  };
  const fail = (err) => setMessage({ tone: "error", text: err.message });
  const toggle = useMutation({
    mutationFn: (isActive) => setUserActive(id, isActive),
    onSuccess: (_, isActive) => done(isActive ? "Account reactivated." : "Account suspended and signed out everywhere."),
    onError: fail,
  });
  const signOut = useMutation({ mutationFn: () => signOutUser(id), onSuccess: () => done("Signed out of every device."), onError: fail });

  if (error && !data) {
    return (
      <div className="admin-user-detail admin-error" role="alert">
        <AlertTriangle size={18} />
        <span>{error.message}</span>
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="admin-user-detail">
        <span className="admin-skeleton admin-skeleton-line" />
      </div>
    );
  }

  const { user } = data;
  const busy = toggle.isPending || signOut.isPending;
  const facts = [
    ["Trips", user.counts.trips],
    ["Groups", user.counts.groups],
    ["Assistant chats", user.counts.chats],
    ["Expenses paid", user.counts.expenses],
    ["Documents", user.counts.documents],
    ["Signed in on", `${user.liveSessions} ${user.liveSessions === 1 ? "device" : "devices"}`],
  ];

  return (
    <div className="admin-user-detail">
      <dl className="admin-user-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="admin-user-columns">
        <div>
          <h3>Recent trips</h3>
          {user.recentTrips.length === 0 ? (
            <p className="admin-user-none">No trips yet.</p>
          ) : (
            <ul>
              {user.recentTrips.map((trip) => (
                <li key={trip.id}>
                  {trip.title} <small>{trip.status.toLowerCase()}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Recent sign-ins</h3>
          {user.recentLogins.length === 0 ? (
            <p className="admin-user-none">No sign-ins recorded.</p>
          ) : (
            <ul>
              {user.recentLogins.slice(0, 5).map((login, index) => (
                <li key={index} className={login.success ? "" : "failed"}>
                  {new Date(login.at).toLocaleString()} <small>{login.success ? deviceName(login) : "failed attempt"}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {message && (
        <p className={`admin-notice ${message.tone}`} role={message.tone === "error" ? "alert" : "status"}>
          <span>{message.text}</span>
        </p>
      )}

      <div className="admin-user-actions">
        {user.isAdmin ? (
          <span className="admin-user-none">Administrators can&apos;t be suspended.</span>
        ) : user.isActive ? (
          <button
            type="button"
            className="admin-button danger"
            disabled={busy}
            onClick={() =>
              window.confirm("Suspend this account? They will be signed out and unable to sign in until you reactivate it.") && toggle.mutate(false)
            }
          >
            <ShieldAlert size={15} /> Suspend account
          </button>
        ) : (
          <button type="button" className="admin-button" disabled={busy} onClick={() => toggle.mutate(true)}>
            <UserCheck size={15} /> Reactivate account
          </button>
        )}
        <button type="button" className="admin-link-button" disabled={busy || user.liveSessions === 0} onClick={() => signOut.mutate()}>
          <LogOut size={14} /> Sign out of all devices
        </button>
        <button type="button" className="admin-link-button" onClick={() => onOpenAudit(id)}>
          <ClipboardList size={14} /> Admin history
        </button>
      </div>
    </div>
  );
}

function UserStatus({ user }) {
  const [status, label] = !user.isActive ? ["down", "Suspended"] : !user.isVerified ? ["degraded", "Unverified"] : ["online", "Active"];
  return (
    <span className={`admin-status-pill ${status}`}>
      <span className="admin-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

// Registered users with their most recent successful login (LoginEvent). Filter by
// state, open a row to manage the account, or download everyone as a spreadsheet.
export default function UserProfilesList({ onOpenAudit, initialStatus = "" }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [sort, setSort] = useState("newest");
  const [openId, setOpenId] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [picked, setPicked] = useState(() => new Set()); // ids ticked for a bulk action
  const [bulkMessage, setBulkMessage] = useState(null);

  // wait for a pause in typing before querying, and go back to page 1 for a new search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    ...adminUsersQuery({ page, q, status, sort }),
    retry: retryUnlessForbidden,
  });

  const exportCsv = useMutation({
    mutationFn: exportUsersCsv,
    onSuccess: (csv) => {
      setExportError(null);
      downloadText("roamio-users.csv", csv);
    },
    onError: (err) => setExportError(err.message),
  });

  const bulk = useMutation({
    mutationFn: ({ action }) => bulkUsers([...picked], action),
    onSuccess: ({ done, failed }) => {
      setBulkMessage({ tone: failed.length ? "error" : "ok", text: `${done} updated${failed.length ? `, ${failed.length} skipped (${failed[0].message})` : ""}.` });
      setPicked(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (err) => setBulkMessage({ tone: "error", text: err.message }),
  });
  const runBulk = (action, question) => window.confirm(`${question} ${picked.size} selected ${picked.size === 1 ? "user" : "users"}?`) && bulk.mutate({ action });
  const toggle = (id) =>
    setPicked((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const reload = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  const filter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
    setOpenId(null);
    setPicked(new Set());
  };

  const users = data?.users || [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  return (
    <section className="admin-card admin-users" aria-labelledby="admin-users-title">
      <div className="admin-card-heading">
        <div>
          <h2 id="admin-users-title">
            <Users size={18} /> Users
          </h2>
          <p>{data ? `${total} ${status ? STATUSES.find((s) => s.value === status).label.toLowerCase() : "registered"} ${total === 1 ? "user" : "users"}` : "Loading users…"}</p>
        </div>

        <div className="admin-card-actions">
          <label className="admin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by full email or user ID"
              aria-label="Search users"
            />
          </label>
          <select className="admin-select" value={status} onChange={filter(setStatus)} aria-label="Show users">
            {STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="admin-select" value={sort} onChange={filter(setSort)} aria-label="Sort users">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh users"
            title="Refresh users"
          >
            <RefreshCw size={16} className={isFetching ? "admin-spin" : ""} />
          </button>
          <button
            type="button"
            className="admin-icon-button"
            onClick={() => exportCsv.mutate()}
            disabled={exportCsv.isPending}
            aria-label="Download all users as a spreadsheet"
            title="Download all users (CSV)"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {exportError && (
        <p className="admin-notice error" role="alert">
          <span>{exportError}</span>
        </p>
      )}

      {picked.size > 0 && (
        <div className="admin-bulkbar" role="toolbar" aria-label="Bulk actions">
          <strong>{picked.size} selected</strong>
          <button type="button" className="admin-button danger" disabled={bulk.isPending} onClick={() => runBulk("suspend", "Suspend")}>
            <ShieldAlert size={15} /> Suspend
          </button>
          <button type="button" className="admin-button" disabled={bulk.isPending} onClick={() => runBulk("reactivate", "Reactivate")}>
            <UserCheck size={15} /> Reactivate
          </button>
          <button type="button" className="admin-link-button" disabled={bulk.isPending} onClick={() => runBulk("signOut", "Sign out of every device:")}>
            <LogOut size={14} /> Sign out
          </button>
          <button type="button" className="admin-link-button" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      )}
      {bulkMessage && (
        <p className={`admin-notice ${bulkMessage.tone}`} role={bulkMessage.tone === "error" ? "alert" : "status"}>
          <span>{bulkMessage.text}</span>
        </p>
      )}

      {error && !data ? (
        <div className="admin-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error.message}</span>
        </div>
      ) : isPending ? (
        <ul className="admin-user-list" aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <li className="admin-user" key={index}>
              <span className="admin-skeleton admin-user-avatar" />
              <span className="admin-skeleton admin-skeleton-line" />
            </li>
          ))}
        </ul>
      ) : users.length === 0 ? (
        <p className="admin-user-empty">{q || status ? "No users match that." : "No users yet."}</p>
      ) : (
        <ul className="admin-user-list">
          {users.map((user) => (
            <li className="admin-user" key={user.id}>
              <input
                type="checkbox"
                className="admin-user-check"
                checked={picked.has(user.id)}
                onChange={() => toggle(user.id)}
                aria-label={`Select ${user.fullName}`}
              />
              <div className="admin-user-avatar">
                {user.avatarUrl ? <img src={user.avatarUrl} alt="" loading="lazy" /> : initials(user.fullName)}
              </div>
              <div className="admin-user-name">
                <strong>{user.fullName}</strong>
                <span>{user.email}</span>
              </div>
              <UserStatus user={user} />
              <dl className="admin-user-meta">
                <div>
                  <dt>Joined</dt>
                  <dd>{formatDate(user.createdAt)}</dd>
                </div>
                <div>
                  <dt>Last login</dt>
                  <dd className={user.lastLoginAt ? "" : "unset"} title={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : undefined}>
                    {formatLastLogin(user.lastLoginAt)}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="admin-icon-button"
                onClick={() => setOpenId(openId === user.id ? null : user.id)}
                aria-expanded={openId === user.id}
                aria-label={`${openId === user.id ? "Hide" : "Manage"} ${user.fullName}`}
                title="Manage"
              >
                <ChevronDown size={16} className={openId === user.id ? "admin-flip" : ""} />
              </button>
              {openId === user.id && <UserDetail id={user.id} onChanged={reload} onOpenAudit={onOpenAudit} />}
            </li>
          ))}
        </ul>
      )}

      {total > USERS_PAGE_SIZE && (
        <nav className="admin-pager" aria-label="Users pages">
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
