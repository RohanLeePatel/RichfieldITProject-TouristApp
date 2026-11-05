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
export const adminUsersQuery = ({ page = 1, q = "" } = {}) => ({
  queryKey: ["admin", "users", page, q],
  queryFn: () => authedFetch(`/api/admin/users?page=${page}&pageSize=${USERS_PAGE_SIZE}&q=${encodeURIComponent(q)}`),
  staleTime: 60_000,
  placeholderData: keepPreviousData,
});

// a 403 (not an admin) or 503 (service not set up) won't change on retry;
// anything else gets the usual couple of tries
export const retryUnlessForbidden = (failures, error) => ![403, 503].includes(error?.status) && failures < 2;

// { destinations: [{ id, name, country, lat, lon, radiusM, costIndex, imageUrl, active, enrichedAt, enrichError, stale }],
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
