"""
Offline script for building the seed data - not part of the deployed app,
just something you run by hand when you need to update the dataset:

    python scripts/enrich_destinations.py

Pulls POI counts + a wheelchair-accessibility sample from Geoapify, and
monthly temperature averages from Open-Meteo, for every city in
cities_seed.py. Normalizes everything and writes the result to
data/destinations_seed.json, so the actual app never has to make these calls
live and doesn't depend on having a working key at request time.

Using Open-Meteo instead of OpenWeather here because they're not really doing
the same job - OpenWeather (used elsewhere in the app) gives live current
conditions and short forecasts for an actual trip. This script needs
historical monthly averages instead ("what's July usually like in Bangkok?")
to score climate fit ahead of time. Open-Meteo's archive API does exactly
that for free with no key, which is what a batch job like this needs.
OpenWeather has similar historical data but it's paid. So both APIs are used
in this project, just for different things.

Normalizing interest density: for each tag, we take the count and divide by
whatever city has the highest count for that tag in this batch, so the city
with the most museums gets 1.0 on "history" and everyone else scales relative
to that. This means the numbers are relative to this specific batch of
cities, not some fixed scale - adding more cities later changes everyone's
density score, which is expected.

The counts feeding that are estimates, not raw result lengths: Geoapify pages
at PLACES_LIMIT, so dense cities all came back with exactly that many and
normalized to an identical 1.0. See estimated_poi_count() for how the clipped
ones are extrapolated back out.

Geoapify's free tier is 3000 credits/day for the whole account. The default
6-city batch here uses maybe a few dozen requests, but keep an eye on the
dashboard before scaling this up to way more cities.
"""

from __future__ import annotations

import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lets us import like "scripts.X" without issues
from landmarks.interest_categories import ACCESSIBILITY_SAMPLE_CATEGORIES, INTEREST_CATEGORY_MAP
from scripts.cities_seed import CITIES

GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
PLACES_LIMIT = 500  # Geoapify caps at 1000 (tried it, got a 400) - this is per category per
# city, so it's a relative ranking not a full count anyway. tried 100 before and it was too
# low - dense categories in big cities (like Bangkok's "food" tag) were all maxing out at
# 1.0 density, which defeats the whole point of normalizing
# Per-city raw API results, so a failed run can be resumed without
# re-spending quota. Safe to delete to force a full refetch.
RAW_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / ".enrich_cache"
ACCESSIBLE_VALUES = {"yes", "limited"}
MIN_TAGGED_SAMPLE = 5  # fewer tagged POIs than this and accessibility just reads as "unknown"
SUPPORTED_RATIO = 0.5
POOR_RATIO = 0.15
CLIMATE_YEAR = 2023  # just using one recent full year instead of a proper multi-year average
MAX_WORKERS = 4

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "destinations_seed.json"


def load_geoapify_key() -> str:
    # didn't want to add python-dotenv just for this one script, so just walk
    # up the folders looking for a .env and read it ourselves
    path = Path(__file__).resolve()
    for parent in path.parents:
        candidate = parent / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                if "=" not in line:
                    continue
                key, _, value = line.partition("=")
                if key.strip() == "geoapifyAPIKey":
                    return value.strip().strip('"')
    raise RuntimeError("geoapifyAPIKey not found in any .env up the directory tree.")


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

    response = requests.get(GEOAPIFY_PLACES_URL, params=params, timeout=20)
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
    response = requests.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=20)
    response.raise_for_status()
    daily = response.json()["daily"]

    temps_by_month: dict[str, list[float]] = {}
    rain_by_month: dict[str, list[float]] = {}
    for date_str, temp, rain in zip(
        daily["time"], daily["temperature_2m_mean"], daily["precipitation_sum"]
    ):
        month = str(int(date_str.split("-")[1]))
        if temp is not None:
            temps_by_month.setdefault(month, []).append(temp)
        if rain is not None:
            rain_by_month.setdefault(month, []).append(rain)

    avg_temp = {m: round(sum(v) / len(v), 1) for m, v in temps_by_month.items()}
    # total for the month, not a daily mean - "120mm in March" is the figure
    # people recognise
    total_rain = {m: round(sum(v), 1) for m, v in rain_by_month.items()}
    return avg_temp, total_rain


def fetch_accessibility(api_key: str, lat: float, lon: float, radius_m: int) -> dict:
    tagged = geoapify_places(
        api_key, ACCESSIBILITY_SAMPLE_CATEGORIES, lat, lon, radius_m, conditions="wheelchair"
    )
    tagged_total = len(tagged)
    accessible_count = sum(1 for p in tagged if p.get("datasource", {}).get("raw", {}).get("wheelchair") in ACCESSIBLE_VALUES)
    ratio = (accessible_count / tagged_total) if tagged_total > 0 else None

    if tagged_total < MIN_TAGGED_SAMPLE:
        state = "unknown"
    elif ratio >= SUPPORTED_RATIO:
        state = "supported"
    elif ratio <= POOR_RATIO:
        state = "poor"
    else:
        state = "unknown"  # ratio's in the ambiguous middle, play it safe and don't guess "poor"

    return {"accessibility": state, "accessible_ratio": ratio, "tagged_total": tagged_total}


COVERAGE_PERCENTILE = 0.95
EARTH_RADIUS_M = 6_371_000


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
    them all a density of 1.0 - 41 of 60 countries scored a flat 1.0 for
    restaurants, which made interests (the heaviest dimension at city level)
    blind across half the catalogue. Raising the limit only moves the ceiling;
    Geoapify caps at 1000.

    When the limit is hit, the results returned are the nearest PLACES_LIMIT,
    and they fill a smaller circle than the one searched. Assuming roughly
    even density over the search area, the true count scales with area:

        count ~= PLACES_LIMIT * (search_radius / covered_radius) ** 2

    A city whose 500 nearest restaurants sit within 2km of the centre is
    genuinely denser than one whose 500 span the full 20km, and this tells
    them apart. Counts below the limit are exact and returned unchanged.
    """
    if len(pois) < PLACES_LIMIT:
        return len(pois)

    distances = sorted(
        d for p in pois if (d := _distance_from_centre_m(p, lat, lon)) is not None
    )
    if not distances:
        return len(pois)  # no distances to reason from; leave it clipped

    # the 95th percentile rather than the furthest, so one stray outlying POI
    # cannot drag the covered radius back out to the full search radius
    covered = distances[max(0, int(len(distances) * COVERAGE_PERCENTILE) - 1)]
    if covered <= 0:
        return len(pois)

    return round(PLACES_LIMIT * (radius_m / covered) ** 2)


def enrich_city(api_key: str, city: dict) -> dict:
    # A full run is ~1800 Geoapify requests against a 3000/day free tier, and
    # the seed file is only written once every city has finished - so without
    # this, one failure near the end spends the day's quota and leaves nothing
    # to show for it. Cached cities cost no requests on a retry.
    cached = RAW_CACHE_DIR / f"{city['id']}.json"
    if cached.exists():
        print(f"Enriching {city['name']}... (cached)", flush=True)
        return json.loads(cached.read_text(encoding="utf-8"))

    print(f"Enriching {city['name']}...", flush=True)
    interest_counts = {}
    for tag, categories in INTEREST_CATEGORY_MAP.items():
        pois = geoapify_places(api_key, categories, city["lat"], city["lon"], city["radius_m"])
        interest_counts[tag] = estimated_poi_count(pois, city["radius_m"], city["lat"], city["lon"])
        time.sleep(0.1)  # be polite to the free tier

    accessibility = fetch_accessibility(api_key, city["lat"], city["lon"], city["radius_m"])
    avg_temp_by_month, avg_rain_mm_by_month = fetch_climate_normals(city["lat"], city["lon"])

    raw = {
        "id": city["id"],
        "name": city["name"],
        "country": city["country"],
        "cost_index": city["cost_index"],
        "interest_counts": interest_counts,
        "accessibility": accessibility,
        "avg_temp_by_month": avg_temp_by_month,
        "avg_rain_mm_by_month": avg_rain_mm_by_month,
    }
    RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(raw), encoding="utf-8")
    return raw


def normalize(raw_cities: list[dict]) -> list[dict]:
    """Min-max normalize each interest tag's count against the strongest
    city in this batch for that tag (see module docstring)."""
    max_by_tag = {}
    for tag in INTEREST_CATEGORY_MAP:
        max_by_tag[tag] = max((c["interest_counts"][tag] for c in raw_cities), default=0)

    results = []
    for city in raw_cities:
        # Log scale, not a plain ratio to the batch maximum. Once clipped
        # counts are extrapolated back out (estimated_poi_count) the spread
        # between the densest city and a quiet one is a couple of orders of
        # magnitude, and a straight ratio would crush everything below the
        # leader to near zero - trading saturation at 1.0 for saturation at 0.
        # POI counts are roughly log-distributed across cities anyway, so this
        # keeps the ordering while leaving usable separation in the middle,
        # which is where most of the catalogue sits.
        interest_density = {
            tag: (math.log1p(city["interest_counts"][tag]) / math.log1p(max_by_tag[tag]))
            if max_by_tag[tag] > 0
            else 0.0
            for tag in INTEREST_CATEGORY_MAP
        }
        results.append(
            {
                "id": city["id"],
                "name": city["name"],
                "country": city["country"],
                "features": {
                    "interest_counts": city["interest_counts"],
                    "interest_density": interest_density,
                    "family_poi_density": interest_density.get("family"),
                    "accessibility": city["accessibility"]["accessibility"],
                    "accessible_ratio": city["accessibility"]["accessible_ratio"],
                    "tagged_total": city["accessibility"]["tagged_total"],
                    "cost_index": city["cost_index"],
                    "climate": {
                        "avg_temp_by_month": city["avg_temp_by_month"],
                        "avg_rain_mm_by_month": city["avg_rain_mm_by_month"],
                    },
                    "safety_index": None,  # don't have a source for this yet, see engine/scorers.py
                },
            }
        )
    return results


def main() -> None:
    api_key = load_geoapify_key()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        raw = list(executor.map(lambda city: enrich_city(api_key, city), CITIES))
    seed = normalize(raw)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    print(f"\nWrote {len(seed)} cities to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
