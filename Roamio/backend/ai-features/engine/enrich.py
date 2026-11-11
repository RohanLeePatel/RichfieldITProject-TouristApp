"""
Builds the numbers the recommendation engine knows about a city: points of
interest counts and a wheelchair sample from Geoapify, monthly climate from
Open-Meteo, and a cover photo from Wikipedia.

Two callers share it, so there is one copy of the rules:
  - POST /destinations/enrich, which the admin dashboard uses to add or refresh
    one city (the Core API stores the result; this service never touches the DB)
  - scripts/enrich_destinations.py, the offline batch that writes the seed JSON

Why Open-Meteo for climate and not OpenWeather: OpenWeather (used elsewhere in
the app) gives live conditions for a trip. Scoring needs historical monthly
averages ("what is July usually like in Bangkok?"), which Open-Meteo's archive
API serves free with no key.

Density is normalised against the strongest city in a batch (see
normalize_entries), so it is computed when the catalog is read, never stored.
Adding one city then shifts everyone's density slightly, which is expected.
"""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote

import requests

import http_client
from landmarks.interest_categories import ACCESSIBILITY_SAMPLE_CATEGORIES, INTEREST_CATEGORY_MAP

GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/"
# identifies the caller, which Wikimedia asks for
WIKIPEDIA_HEADERS = {"User-Agent": "Roamio/1.0 (university project; destination cover images)"}

# Geoapify caps at 1000 (a bigger limit gets a 400). This is per category per city,
# so it is a relative ranking, not a full count. 100 was too low: dense categories in
# big cities all maxed out at density 1.0.
PLACES_LIMIT = 500
REQUEST_TIMEOUT_SECONDS = 20
ACCESSIBLE_VALUES = {"yes", "limited"}
MIN_TAGGED_SAMPLE = 5  # fewer tagged POIs than this and accessibility just reads as "unknown"
SUPPORTED_RATIO = 0.5
POOR_RATIO = 0.15
CLIMATE_YEAR = 2023  # one recent full year instead of a proper multi-year average
COVERAGE_PERCENTILE = 0.95
EARTH_RADIUS_M = 6_371_000


class EnrichmentError(RuntimeError):
    """A provider call failed; the message is safe to show an administrator."""


def geoapify_places(
    api_key: str, categories: list[str], lat: float, lon: float, radius_m: int, conditions: str | None = None
) -> list[dict]:
    params = {
        "categories": ",".join(categories),
        "filter": f"circle:{lon},{lat},{radius_m}",
        "limit": PLACES_LIMIT,
        "apiKey": api_key,
    }
    if conditions:
        params["conditions"] = conditions

    response = http_client.get(GEOAPIFY_PLACES_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    return [f["properties"] for f in response.json()["features"]]


def fetch_climate_normals(lat: float, lon: float) -> tuple[dict[str, float], dict[str, float]]:
    """
    Monthly mean temperature and monthly total rainfall, keyed '1'..'12'.

    Temperature alone scored a warm month in the middle of a monsoon the same
    as a dry one, so rainfall comes back with it - same request, no extra
    quota, since Open-Meteo takes both variables at once.
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": f"{CLIMATE_YEAR}-01-01",
        "end_date": f"{CLIMATE_YEAR}-12-31",
        "daily": "temperature_2m_mean,precipitation_sum",
        "timezone": "auto",
    }
    response = http_client.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    response.raise_for_status()
    daily = response.json()["daily"]

    temps_by_month: dict[str, list[float]] = {}
    rain_by_month: dict[str, list[float]] = {}
    for date_str, temp, rain in zip(daily["time"], daily["temperature_2m_mean"], daily["precipitation_sum"]):
        month = str(int(date_str.split("-")[1]))
        if temp is not None:
            temps_by_month.setdefault(month, []).append(temp)
        if rain is not None:
            rain_by_month.setdefault(month, []).append(rain)

    avg_temp = {m: round(sum(v) / len(v), 1) for m, v in temps_by_month.items()}
    # total for the month, not a daily mean - "120mm in March" is the figure people recognise
    total_rain = {m: round(sum(v), 1) for m, v in rain_by_month.items()}
    return avg_temp, total_rain


def fetch_accessibility(api_key: str, lat: float, lon: float, radius_m: int) -> dict:
    tagged = geoapify_places(api_key, ACCESSIBILITY_SAMPLE_CATEGORIES, lat, lon, radius_m, conditions="wheelchair")
    tagged_total = len(tagged)
    accessible_count = sum(
        1 for p in tagged if p.get("datasource", {}).get("raw", {}).get("wheelchair") in ACCESSIBLE_VALUES
    )
    ratio = (accessible_count / tagged_total) if tagged_total > 0 else None

    if ratio is None or tagged_total < MIN_TAGGED_SAMPLE:
        state = "unknown"
    elif ratio >= SUPPORTED_RATIO:
        state = "supported"
    elif ratio <= POOR_RATIO:
        state = "poor"
    else:
        state = "unknown"  # ratio is in the ambiguous middle: play it safe and don't guess "poor"

    return {"accessibility": state, "accessible_ratio": ratio, "tagged_total": tagged_total}


def _distance_from_centre_m(poi: dict, lat: float, lon: float) -> float | None:
    """
    Metres from the search centre to a POI. Geoapify's places response carries
    lat/lon but no `distance` field, so it is computed here - equirectangular,
    which is well within tolerance over a city-sized radius and needs no
    dependency.
    """
    poi_lat, poi_lon = poi.get("lat"), poi.get("lon")
    if not isinstance(poi_lat, (int, float)) or not isinstance(poi_lon, (int, float)):
        return None
    x = math.radians(poi_lon - lon) * math.cos(math.radians((lat + poi_lat) / 2))
    y = math.radians(poi_lat - lat)
    return math.hypot(x, y) * EARTH_RADIUS_M


def estimated_poi_count(pois: list[dict], radius_m: int, lat: float, lon: float) -> int:
    """
    A count that does not flatten out at the API's page limit.

    Geoapify returns at most PLACES_LIMIT results, so every dense city came
    back with exactly that many and normalising against the batch maximum gave
    them all a density of 1.0. When the limit is hit, the results are the
    nearest PLACES_LIMIT and fill a smaller circle than the one searched.
    Assuming roughly even density over the search area, the true count scales
    with area:

        count ~= PLACES_LIMIT * (search_radius / covered_radius) ** 2

    A city whose 500 nearest restaurants sit within 2km of the centre is
    genuinely denser than one whose 500 span the full 20km. Counts below the
    limit are exact and returned unchanged.
    """
    if len(pois) < PLACES_LIMIT:
        return len(pois)

    distances = sorted(d for p in pois if (d := _distance_from_centre_m(p, lat, lon)) is not None)
    if not distances:
        return len(pois)  # no distances to reason from; leave it clipped

    # the 95th percentile rather than the furthest, so one stray outlying POI
    # cannot drag the covered radius back out to the full search radius
    covered = distances[max(0, int(len(distances) * COVERAGE_PERCENTILE) - 1)]
    if covered <= 0:
        return len(pois)

    return round(PLACES_LIMIT * (radius_m / covered) ** 2)


def enrich_city_raw(api_key: str, lat: float, lon: float, radius_m: int, workers: int = 1) -> dict:
    """
    Everything provider-sourced about one city, before normalisation:

        interest_counts, accessibility, accessible_ratio, tagged_total,
        avg_temp_by_month, avg_rain_mm_by_month

    `workers` > 1 fetches the interest categories in parallel (the admin call,
    which must finish inside a serverless time limit). The batch script keeps 1
    and parallelises across cities instead. Raises EnrichmentError.
    """

    def count_for(categories: list[str]) -> int:
        pois = geoapify_places(api_key, categories, lat, lon, radius_m)
        return estimated_poi_count(pois, radius_m, lat, lon)

    try:
        with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
            counts = list(pool.map(count_for, INTEREST_CATEGORY_MAP.values()))
        accessibility = fetch_accessibility(api_key, lat, lon, radius_m)
        avg_temp, avg_rain = fetch_climate_normals(lat, lon)
    except (requests.RequestException, KeyError, ValueError) as error:
        # the request URL carries the Geoapify key, so never pass the exception text on
        raise EnrichmentError(f"A data provider did not answer ({type(error).__name__}).") from error

    return {
        "interest_counts": dict(zip(INTEREST_CATEGORY_MAP, counts)),
        **accessibility,
        "avg_temp_by_month": avg_temp,
        "avg_rain_mm_by_month": avg_rain,
    }


def fetch_thumbnail(title: str) -> str | None:
    """A cover photo from the Wikipedia summary endpoint (free, no key), or None."""
    try:
        response = http_client.get(
            f"{WIKIPEDIA_SUMMARY_URL}{quote(title.replace(' ', '_'), safe='')}", headers=WIKIPEDIA_HEADERS, timeout=15
        )
        if not response.ok:
            return None
        data = response.json()
        # a disambiguation page has no single subject, so its thumbnail would be arbitrary
        if data.get("type") == "disambiguation":
            return None
        # the 'thumbnail' is a few hundred pixels wide, which is what a card needs
        return (data.get("thumbnail") or {}).get("source")
    except requests.RequestException:
        return None


def find_cover_image(name: str, country: str) -> str | None:
    # "Name, Country" first: the bare name can land on a different place entirely
    # ("East London" is London's East End, not the South African city)
    for title in (f"{name}, {country}", name):
        url = fetch_thumbnail(title)
        if url:
            return url
    return None


def normalize_entries(entries: list[dict]) -> list[dict]:
    """
    Raw per-city rows -> the seed-file shape (a Candidate as a dict).

    Each interest tag's count goes on a log scale against the strongest city in
    this batch for that tag. Once clipped counts are extrapolated back out the
    spread between the densest city and a quiet one is orders of magnitude, and a
    straight ratio would crush everything below the leader to near zero. POI
    counts are roughly log-distributed anyway, so this keeps the ordering and
    leaves usable separation in the middle.

    Each entry: id, name, country, image_url (optional), cost_index, and the
    enrich_city_raw fields. A tag a city has no count for counts as 0.
    """
    max_by_tag = {tag: max((e["interest_counts"].get(tag, 0) for e in entries), default=0) for tag in INTEREST_CATEGORY_MAP}

    results = []
    for e in entries:
        counts = {tag: e["interest_counts"].get(tag, 0) for tag in INTEREST_CATEGORY_MAP}
        density = {
            tag: (math.log1p(counts[tag]) / math.log1p(max_by_tag[tag])) if max_by_tag[tag] > 0 else 0.0
            for tag in INTEREST_CATEGORY_MAP
        }
        city = {
            "id": e["id"],
            "name": e["name"],
            "country": e["country"],
            "features": {
                "interest_counts": counts,
                "interest_density": density,
                "family_poi_density": density.get("family"),
                "accessibility": e.get("accessibility", "unknown"),
                "accessible_ratio": e.get("accessible_ratio"),
                "tagged_total": e.get("tagged_total", 0),
                "cost_index": e.get("cost_index"),
                "climate": {
                    "avg_temp_by_month": e.get("avg_temp_by_month") or {},
                    "avg_rain_mm_by_month": e.get("avg_rain_mm_by_month") or {},
                },
                "safety_index": None,  # filled in per request from the travel advisory, see engine/safety.py
            },
        }
        if e.get("image_url"):
            city["image_url"] = e["image_url"]
        results.append(city)
    return results
