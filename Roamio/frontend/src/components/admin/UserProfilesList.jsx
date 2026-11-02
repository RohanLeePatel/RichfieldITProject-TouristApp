import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Search, Users } from "lucide-react";

import { adminUsersQuery, retryUnlessForbidden, USERS_PAGE_SIZE } from "../../api/admin.js";

const SKELETON_ROWS = 5;

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

function UserStatus({ user }) {
  const [status, label] = !user.isActive ? ["down", "Inactive"] : !user.isVerified ? ["degraded", "Unverified"] : ["online", "Active"];
  return (
    <span className={`admin-status-pill ${status}`}>
      <span className="admin-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

// Registered users with their most recent successful login (LoginEvent), newest accounts first.
export default function UserProfilesList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  // wait for a pause in typing before querying, and go back to page 1 for a new search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, error, refetch, isFetching } = useQuery({
    ...adminUsersQuery({ page, q }),
    retry: retryUnlessForbidden,
  });

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
          <p>{data ? `${total} registered ${total === 1 ? "user" : "users"}` : "Loading users…"}</p>
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
        </div>
      </div>

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
        <p className="admin-user-empty">{q ? "No users match that search." : "No users yet."}</p>
      ) : (
        <ul className="admin-user-list">
          {users.map((user) => (
            <li className="admin-user" key={user.id}>
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
