import { authedFetch } from "./client";

// A place is a trip's destination text, e.g. "Cape Town, South Africa".

export const REPORT_REASONS = [
  { id: "CLOSED", label: "Closed or not there" },
  { id: "UNSAFE", label: "Unsafe" },
  { id: "WRONG_INFO", label: "Wrong information" },
  { id: "SCAM", label: "Scam or overcharging" },
  { id: "OTHER", label: "Something else" },
];

// { avgRating: number | null, reviewCount, mine: { rating, comment } | null }
export const fetchPlaceRating = (place) => authedFetch(`/api/places/rating?place=${encodeURIComponent(place)}`);

// Allowed once per place after a finished trip
export const ratePlace = (place, rating, comment) =>
  authedFetch("/api/places/review", { method: "POST", body: JSON.stringify({ place, rating, comment }) });

// Allowed from any of your trips there, once per place
export const reportPlace = ({ place, reason, note, tripId, itineraryItemId }) =>
  authedFetch("/api/places/report", { method: "POST", body: JSON.stringify({ place, reason, note, tripId, itineraryItemId }) });

// Admin: [{ placeKey, name, reportCount, flagged, lastReportedAt, reports: [{ reason, note, itineraryStop, createdAt }] }]
export const adminReportsQuery = {
  queryKey: ["admin", "place-reports"],
  queryFn: () => authedFetch("/api/admin/reports"),
  staleTime: 30_000,
};

// status: "RESOLVED" | "DISMISSED" - closes every open report for that place
export const closePlaceReports = (placeKey, status) =>
  authedFetch("/api/admin/reports", { method: "PATCH", body: JSON.stringify({ placeKey, status }) });
