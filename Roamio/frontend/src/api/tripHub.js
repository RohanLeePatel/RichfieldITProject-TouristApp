import { authedFetch } from "./client";

// Country advisory by alpha-3 code (utils/countries.js); the name finds the
// few countries the advisory feed lists without a code. 404 = no data for
// that country, which the hub shows as "safety data unavailable".
// { countryIso, riskLevel 1-4, advisoryLevel, summary, emergencyNumbers, source, lastUpdated, link }
export async function fetchCountrySafety(iso3, name) {
  const query = name ? `?name=${encodeURIComponent(name)}` : "";
  const data = await authedFetch(`/api/safety/${encodeURIComponent(iso3)}${query}`);
  return data.safety;
}

// [{ id, action, entityType, details, createdAt, user: { fullName } }]
export async function fetchTripActivity(tripId) {
  const data = await authedFetch(`/api/trips/${tripId}/activity`);
  return data.activityFeed || [];
}
