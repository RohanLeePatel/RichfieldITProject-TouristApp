import { authedFetch } from "./client";

// Country advisory by alpha-3 code (utils/countries.js). 404 = no data for
// that country, which the hub shows as "safety data unavailable".
// { countryIso, riskLevel 1-4, advisoryLevel, summary, emergencyNumbers, source, lastUpdated }
export async function fetchCountrySafety(iso3) {
  const data = await authedFetch(`/api/safety/${encodeURIComponent(iso3)}`);
  return data.safety;
}

// [{ id, action, entityType, details, createdAt, user: { fullName } }]
export async function fetchTripActivity(tripId) {
  const data = await authedFetch(`/api/trips/${tripId}/activity`);
  return data.activityFeed || [];
}
