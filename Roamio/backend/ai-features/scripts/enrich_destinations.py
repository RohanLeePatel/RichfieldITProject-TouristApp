"""
Offline script for building the FALLBACK seed data - not part of the deployed app.
The live catalog now lives in the database and is managed from the admin
dashboard (Destinations); this file only rebuilds data/destinations_seed.json,
which the recommendation service falls back to when the database has no
destinations. Run it by hand if you want that fallback refreshed:

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
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # lets us import like "scripts.X" without issues
from engine.enrich import enrich_city_raw, normalize_entries
from scripts.cities_seed import CITIES

MAX_WORKERS = 4
# Per-city raw API results, so a failed run can be resumed without
# re-spending quota. Safe to delete to force a full refetch.
RAW_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / ".enrich_cache"
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


def enrich_city(api_key: str, city: dict) -> dict:
    # A full run is ~1800 Geoapify requests against a 3000/day free tier, and
    # the seed file is only written once every city has finished - so without
    # this, one failure near the end spends the day's quota and leaves nothing
    # to show for it. Cached cities cost no requests on a retry.
    cached = RAW_CACHE_DIR / f"{city['id']}.json"
    if cached.exists():
        print(f"Enriching {city['name']}... (cached)", flush=True)
        old = json.loads(cached.read_text(encoding="utf-8"))
        accessibility = old.pop("accessibility")  # cache files predate the flat shape
        return {**old, **accessibility}

    print(f"Enriching {city['name']}...", flush=True)
    raw = enrich_city_raw(api_key, city["lat"], city["lon"], city["radius_m"])
    entry = {"id": city["id"], "name": city["name"], "country": city["country"], "cost_index": city["cost_index"], **raw}

    RAW_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(entry), encoding="utf-8")
    return entry


def main() -> None:
    api_key = load_geoapify_key()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        raw = list(executor.map(lambda city: enrich_city(api_key, city), CITIES))
    seed = normalize_entries(raw)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(seed, indent=2), encoding="utf-8")
    print(f"\nWrote {len(seed)} cities to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
