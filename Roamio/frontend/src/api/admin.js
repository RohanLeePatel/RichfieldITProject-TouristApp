import { keepPreviousData } from "@tanstack/react-query";

import { authedFetch } from "./client";

export const USERS_PAGE_SIZE = 20;

// Admin dashboard endpoints. The API answers 403 to anyone who isn't an admin.
// Shared as React Query options so AdminRoute and the page use one cache entry.

// { clarityProjectId, gaMeasurementId } - either may be null
export const trackingConfigQuery = {
  queryKey: ["admin", "tracking"],
  queryFn: () => authedFetch("/api/admin/config/tracking"),
  staleTime: 5 * 60_000,
};

// { checkedAt, services: { database, storage, deepl, aiService, email, gemini, weather, geoapify,
//   fastforex, travelRisk, analytics: { status, latencyMs, detail? } } }
export const serviceHealthQuery = {
  queryKey: ["admin", "health"],
  queryFn: () => authedFetch("/api/admin/health/services"),
  refetchInterval: 30_000,
};

// { dailyActiveUsers, last7Days, last30Days: { activeUsers, pageViews, avgSessionDurationSeconds } }
export const analyticsOverviewQuery = {
  queryKey: ["admin", "analytics"],
  queryFn: () => authedFetch("/api/admin/analytics/overview"),
  staleTime: 5 * 60_000,
};

// { users: [{ id, fullName, email, avatarUrl, isActive, isVerified, createdAt, lastLoginAt, lastDevice }], page, pageSize, total }
// status: "" | "active" | "unverified" | "suspended"; sort: "newest" | "oldest"
export const adminUsersQuery = ({ page = 1, q = "", status = "", sort = "newest" } = {}) => ({
  queryKey: ["admin", "users", page, q, status, sort],
  queryFn: () =>
    authedFetch(`/api/admin/users?page=${page}&pageSize=${USERS_PAGE_SIZE}&q=${encodeURIComponent(q)}&status=${status}&sort=${sort}`),
  staleTime: 60_000,
  placeholderData: keepPreviousData,
});

// { user: { ...list fields, isAdmin, counts: { trips, groups, chats, expenses, documents }, liveSessions,
//   recentTrips: [{ id, title, status, role }], recentLogins: [{ at, browser, os, deviceType, success }] } }
export const adminUserQuery = (id) => ({
  queryKey: ["admin", "user", id],
  queryFn: () => authedFetch(`/api/admin/users/${encodeURIComponent(id)}`),
  staleTime: 15_000,
});

const userSend = (id, path, method, body) =>
  authedFetch(`/api/admin/users/${encodeURIComponent(id)}${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
export const setUserActive = (id, isActive) => userSend(id, "", "PATCH", { isActive });
export const signOutUser = (id) => userSend(id, "/sign-out", "POST");

// the whole user list as CSV text
export const exportUsersCsv = () => authedFetch("/api/admin/users/export.csv");

// What people do in the app, worked out from our own tables. days: 7 | 30 | 90.
// { days, kpis: { totalUsers|newUsers|activeUsers|trips: { value, previous, series: [{ date, value }] } },
//   topDestinations: { places|cities|countries: [{ label, sub, count, previous }] },
//   funnel: [{ key, label, count }], retention: { newUsers, returned, rate },
//   features: [{ key, label, count, previous }],
//   collaboration: { groups, invitesSent, invitesAccepted, acceptRate, avgGroupSize } }
export const adminInsightsQuery = (days) => ({
  queryKey: ["admin", "insights", days],
  queryFn: () => authedFetch(`/api/admin/insights?days=${days}`),
  staleTime: 2 * 60_000,
  placeholderData: keepPreviousData,
});

// a 403 (not an admin) or 503 (service not set up) won't change on retry;
// anything else gets the usual couple of tries
export const retryUnlessForbidden = (failures, error) => ![403, 503].includes(error?.status) && failures < 2;

// { destinations: [{ id, name, country, lat, lon, radiusM, costIndex, imageUrl, active, enrichedAt, enrichError, stale,
//   issues: ["no_photo" | "no_data" | "old_data" | "fetch_failed"], tripCount }],
//   staleAfterDays } - the cities the recommendation engine can suggest, hidden ones included
export const adminDestinationsQuery = {
  queryKey: ["admin", "destinations"],
  queryFn: () => authedFetch("/api/admin/destinations"),
  staleTime: 60_000,
};

const send = (path, method, body) =>
  authedFetch(`/api/admin/destinations${path}`, { method, ...(body ? { body: JSON.stringify(body) } : {}) });

// { name, country, costIndex? }, plus { lat, lon, radiusM? } to skip the lookup by name. Resolves
// { destination, enrichError }: the city is saved even when fetching its data failed.
export const createDestination = (fields) => send("", "POST", fields);
export const updateDestination = (id, fields) => send(`/${encodeURIComponent(id)}`, "PATCH", fields);
export const refreshDestination = (id) => send(`/${encodeURIComponent(id)}/enrich`, "POST");
export const deleteDestination = (id) => send(`/${encodeURIComponent(id)}`, "DELETE");

// show or hide several cities at once; resolves { updated }
export const bulkSetDestinations = (ids, active) => send("/bulk", "POST", { ids, active });

// What admins did, newest first. { entries: [{ id, at, action, admin: { id, name },
// target: { type, id, name }, details }], page, pageSize, total }
export const adminAuditQuery = (page = 1) => ({
  queryKey: ["admin", "audit", page],
  queryFn: () => authedFetch(`/api/admin/audit?page=${page}`),
  staleTime: 30_000,
  placeholderData: keepPreviousData,
});
export const AUDIT_PAGE_SIZE = 25;

const report = (name, days) => ({
  queryKey: ["admin", "reports", name, days],
  queryFn: () => authedFetch(`/api/admin/reports/${name}${days ? `?days=${days}` : ""}`),
  staleTime: 2 * 60_000,
  placeholderData: keepPreviousData,
});

// { activeUsers, devices|browsers|systems|languages|currencies|themes: [{ label, count }] }
export const audienceQuery = (days) => report("audience", days);

// { push: { users, devices, failingDevices }, preferences: { total, emailRate, pushRate },
//   notifications: { sent, previous, read, readRate, byType: [{ label, count }] } }
export const engagementQuery = (days) => report("engagement", days);

// { expenses: { count, previous, perTrip }, totals: [{ currency, total, count }],
//   categories: [{ label, count, share }], budgets: [{ currency, average, count }],
//   settlement: { total, settled, rate } }
export const spendingQuery = (days) => report("spending", days);

// { staleAfterDays, usingMockData, advisories: [{ country, riskLevel, advisoryLevel, lastUpdated, source, stale }],
//   missing: [country], openAlerts: [{ riskLevel, count }], tripsAtRisk: [{ id, title, status, startDate, country, riskLevel }] }
export const safetyQuery = { ...report("safety"), refetchInterval: false };

// starts a background re-check of every advisory
export const startSafetySync = () => authedFetch("/api/admin/reports/safety/sync", { method: "POST" });
