import { authedFetch } from "./client";

// Admin dashboard endpoints. The API answers 403 to anyone who isn't an admin.
// Shared as React Query options so AdminRoute and the page use one cache entry.

// { clarityProjectId, gaMeasurementId } - either may be null
export const trackingConfigQuery = {
  queryKey: ["admin", "tracking"],
  queryFn: () => authedFetch("/api/admin/config/tracking"),
  staleTime: 5 * 60_000,
};

// { checkedAt, services: { database, storage, deepl: { status, latencyMs, detail? } } }
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

// a 403 won't change on retry; anything else gets the usual couple of tries
export const retryUnlessForbidden = (failures, error) => error?.status !== 403 && failures < 2;
