// Free, keyless data sources (all allow browser calls):
//  - Open-Meteo geocoding + historical archive (CC BY 4.0, non-commercial use)
//  - Wikipedia REST summary (CC BY-SA)
// Results are cached in sessionStorage so re-opening a card doesn't refetch.
import { summarizeClimate } from "../utils/travelAdvice.js";

const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive";
const WIKI_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary";
const YEARS_OF_HISTORY = 10;

function cached(key, load) {
  try {
    const hit = sessionStorage.getItem(key);
    if (hit) return Promise.resolve(JSON.parse(hit));
  } catch {
    // storage blocked - just fetch
  }
  return load().then((value) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full/blocked - fine
    }
    return value;
  });
}

// "Lima" + "Peru" -> { name, country, countryCode, latitude, longitude }.
// Country helps pick the right one of several same-named places.
export function geocodePlace(name, country) {
  return cached(`geo:${name}|${country || ""}`, async () => {
    const params = new URLSearchParams({ name, count: "10", language: "en", format: "json" });
    const response = await fetch(`${GEOCODING_API}?${params}`);
    if (!response.ok) throw new Error("Could not look up that place.");
    const results = (await response.json()).results || [];
    const wanted = country?.trim().toLowerCase();
    const match = results.find((r) => wanted && (r.country || "").toLowerCase() === wanted) || results[0];
    if (!match) throw new Error(`No location found for "${name}".`);
    return {
      name: match.name,
      country: match.country || country || "",
      countryCode: match.country_code || "",
      latitude: match.latitude,
      longitude: match.longitude,
    };
  });
}

// 12 monthly averages built from the last 10 full years of daily records.
export function fetchClimate(latitude, longitude) {
  return cached(`climate:${latitude.toFixed(2)},${longitude.toFixed(2)}`, async () => {
    const lastYear = new Date().getFullYear() - 1;
    const params = new URLSearchParams({
      latitude,
      longitude,
      start_date: `${lastYear - YEARS_OF_HISTORY + 1}-01-01`,
      end_date: `${lastYear}-12-31`,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      timezone: "auto",
    });
    const response = await fetch(`${ARCHIVE_API}?${params}`);
    if (!response.ok) throw new Error("Historical weather is unavailable right now.");
    const data = await response.json();
    return { months: summarizeClimate(data.daily), fromYear: lastYear - YEARS_OF_HISTORY + 1, toYear: lastYear };
  });
}

// Short "about this place" text. Tries "Name", then "Name, Country"; skips
// disambiguation pages. Returns null when Wikipedia has nothing useful.
export function fetchPlaceSummary(name, country) {
  return cached(`wiki:${name}|${country || ""}`, async () => {
    const titles = [name, country ? `${name}, ${country}` : null].filter(Boolean);
    for (const title of titles) {
      const response = await fetch(`${WIKI_SUMMARY_API}/${encodeURIComponent(title.replace(/ /g, "_"))}`);
      if (!response.ok) continue;
      const page = await response.json();
      if (page.type === "standard" && page.extract) {
        return { extract: page.extract, url: page.content_urls?.desktop?.page || null, thumbnail: page.thumbnail?.source || null };
      }
    }
    return null;
  });
}
