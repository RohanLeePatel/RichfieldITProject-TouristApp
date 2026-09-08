"""
§2 offline enrichment script — a dev tool, NOT part of the deployed Vercel
function (D4). Run manually:

    python scripts/enrich_destinations.py

Pulls POI category counts + accessibility sample (Geoapify) and monthly
temperature normals (Open-Meteo, keyless) for the cities in cities_seed.py,
normalizes, and writes committed seed JSON to data/destinations_seed.json
so the demo never depends on a live key (D4/D5, §9 open risk mitigation).

Why Open-Meteo and not OpenWeather here: the project's OpenWeather
integration (elsewhere in the app) serves *live* current conditions and a
short-term forecast for a traveler's actual trip — a different feature from
what this script needs. This script instead needs long-run *historical
monthly averages* ("what's July usually like in Bangkok?") to score climate
fit ahead of time, offline, for every seed city. Open-Meteo's archive API
provides exactly that, for free and without a key, which fits a batch job
that's re-run whenever the seed set grows (see D4 above). OpenWeather's
equivalent historical/statistical data sits behind a paid plan. Both APIs
are in use in this project — OpenWeather for live forecasts, Open-Meteo for
this enrichment step — they are not interchangeable for this purpose.

Normalisation (§2 "pick one and document which"): interest density per tag
is min-max normalized against the strongest city *in this seed batch* for
that tag (count / max_count_for_tag), so the city with the most museums
scores 1.0 on "history" and the rest scale relative to it. This is
batch-relative, not an absolute count — re-running with a larger city list
changes every city's density, which is expected (D4: this script re-runs
whenever the seed set grows).

Geoapify's free tier is a shared 3000-credits/day budget across your whole
account. This script's default 6-city batch costs on the order of a few
dozen requests; watch your dashboard before scaling to the plan's full
15-30 city set.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # so "scripts.X" style imports aren't needed
from landmarks.interest_categories import ACCESSIBILITY_SAMPLE_CATEGORIES, INTEREST_CATEGORY_MAP
from scripts.cities_seed import CITIES

GEOAPIFY_PLACES_URL = "https://api.geoapify.com/v2/places"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
PLACES_LIMIT = 500  # Geoapify's hard max (1000 returns 400, verified live) — cap per
# category per city, relative ranking not a census. Even 500 can still
# saturate a dense category in a huge city (Bangkok's "food" tag, e.g.);
# the earlier 100 cap made this far worse — most cities in this starter
# batch were clipping to 1.0 density on multiple tags, flattening exactly
# the differentiation normalization exists to produce.
ACCESSIBLE_VALUES = {"yes", "limited"}
MIN_TAGGED_SAMPLE = 5  # below this, accessibility reads as "unknown" — too sparse to trust (§3)
SUPPORTED_RATIO = 0.5
POOR_RATIO = 0.15
# A full recent year, not a true multi-year "normal" — documented shortcut
# for the starter batch (see module docstring).
CLIMATE_YEAR = 2023

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "destinations_seed.json"


def load_geoapify_key() -> str:
    # No python-dotenv dependency added just for this dev script — walk up
    # to the repo root .env and parse it directly.
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


def fetch_climate_normals(lat: float, lon: float) -> dict[str, float]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": f"{CLIMATE_YEAR}-01-01",
        "end_date": f"{CLIMATE_YEAR}-12-31",
        "daily": "temperature_2m_mean",
        "timezone": "auto",
    }
    response = requests.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=20)
    response.raise_for_status()
    daily = response.json()["daily"]

    by_month: dict[str, list[float]] = {}
    for date_str, temp in zip(daily["time"], daily["temperature_2m_mean"]):
        if temp is None:
            continue
        month = str(int(date_str.split("-")[1]))
        by_month.setdefault(month, []).append(temp)

    return {month: round(sum(temps) / len(temps), 1) for month, temps in by_month.items()}


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
        state = "unknown"  # ambiguous middle — conservative, never guesses "poor" (§9 open risk)

    return {"accessibility": state, "accessible_ratio": ratio, "tagged_total": tagged_total}


def enrich_city(api_key: str, city: dict) -> dict:
    print(f"Enriching {city['name']}...")
    interest_counts = {}
    for tag, categories in INTEREST_CATEGORY_MAP.items():
        pois = geoapify_places(api_key, categories, city["lat"], city["lon"], city["radius_m"])
        interest_counts[tag] = len(pois)
        time.sleep(0.1)  # be polite to the free tier

    accessibility = fetch_accessibility(api_key, city["lat"], city["lon"], city["radius_m"])
    climate = fetch_climate_normals(city["lat"], city["lon"])

    return {
        "id": city["id"],
        "name": city["name"],
        "country": city["country"],
        "cost_index": city["cost_index"],
        "interest_counts": interest_counts,
        "accessibility": accessibility,
        "avg_temp_by_month": climate,
    }


def normalize(raw_cities: list[dict]) -> list[dict]:
    """Min-max normalize each interest tag's count against the strongest
    city in this batch for that tag (see module docstring)."""
    max_by_tag = {}
    for tag in INTEREST_CATEGORY_MAP:
        max_by_tag[tag] = max((c["interest_counts"][tag] for c in raw_cities), default=0)

    results = []
    for city in raw_cities:
        interest_density = {
            tag: (city["interest_counts"][tag] / max_by_tag[tag]) if max_by_tag[tag] > 0 else 0.0
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
                    "climate": {"avg_temp_by_month": city["avg_temp_by_month"]},
                    "safety_index": None,  # no data source yet — see engine/scorers.py
                },
            }
        )
    return results


def main() -> None:
    api_key = load_geoapify_key()
    raw = [enrich_city(api_key, city) for city in CITIES]
    seed = normalize(raw)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    print(f"\nWrote {len(seed)} cities to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
