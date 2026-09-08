"""
Live Geoapify landmark/POI lookup: place-level half of "travel itinerary
planning". Unlike engine/pipeline.py's country/city scoring, a single
landmark doesn't have its own budget/climate/accessibility profile, so this
doesn't go through the scoring engine — it's a direct geocode + Places
query, grouped by the interest tags the caller asked for.

Same discipline as engine/currency.py and weather/weather.py: a missing key
or failed call reads as an explicit error, never a raised exception the
caller has to guess about. Results are cached in-process (geocoding and
POIs don't change minute to minute) to stay well under Geoapify's shared
free-tier daily credit budget (see scripts/enrich_destinations.py).
"""

from __future__ import annotations

import math
import os
import time

import requests

from landmarks.interest_categories import INTEREST_CATEGORY_MAP

GEOAPIFY_API_KEY = os.environ.get("geoapifyAPIKey")
GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
PLACES_URL = "https://api.geoapify.com/v2/places"
REQUEST_TIMEOUT_SECONDS = 10
CACHE_TTL_SECONDS = 24 * 60 * 60
PLACES_LIMIT_PER_TAG = 10

# key -> (value, fetched_at_monotonic). Two caches, same pattern as
# engine/currency.py's _rate_cache — deliberately shared across requests.
_geocode_cache: dict[tuple[str, int], tuple[tuple[float, float], float]] = {}
_places_cache: dict[tuple[str, str, int], tuple[list[dict], float]] = {}


def _cache_get(cache: dict, key):
    cached = cache.get(key)
    if cached is None:
        return None
    value, fetched_at = cached
    if time.monotonic() - fetched_at >= CACHE_TTL_SECONDS:
        return None
    return value


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def geocode_destination(destination: str, radius_m: int) -> tuple[float, float] | None:
    """Returns (lat, lon) for a destination name, or None if not found/unavailable."""
    cache_key = (destination.lower(), radius_m)
    cached = _cache_get(_geocode_cache, cache_key)
    if cached is not None:
        return cached

    try:
        response = requests.get(
            GEOCODE_URL,
            params={"text": destination, "limit": 1, "apiKey": GEOAPIFY_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        features = response.json().get("features", [])
    except Exception:
        return None

    if not features:
        return None

    lon, lat = features[0]["geometry"]["coordinates"]
    _geocode_cache[cache_key] = ((lat, lon), time.monotonic())
    return (lat, lon)


def _fetch_places(tag: str, lat: float, lon: float, radius_m: int) -> list[dict]:
    cache_key = (f"{lat:.4f},{lon:.4f}", tag, radius_m)
    cached = _cache_get(_places_cache, cache_key)
    if cached is not None:
        return cached

    categories = INTEREST_CATEGORY_MAP.get(tag)
    if not categories:
        return []

    try:
        response = requests.get(
            PLACES_URL,
            params={
                "categories": ",".join(categories),
                "filter": f"circle:{lon},{lat},{radius_m}",
                "bias": f"proximity:{lon},{lat}",
                "limit": PLACES_LIMIT_PER_TAG,
                "apiKey": GEOAPIFY_API_KEY,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        places = [f["properties"] for f in response.json().get("features", [])]
    except Exception:
        return []

    _places_cache[cache_key] = (places, time.monotonic())
    return places


def get_landmarks(destination: str, interests: list[str], radius_m: int = 5000) -> dict:
    if not GEOAPIFY_API_KEY:
        return {"error": "Landmarks error: geoapifyAPIKey is not configured."}

    center = geocode_destination(destination, radius_m)
    if center is None:
        return {"error": f'Could not locate "{destination}".'}
    lat, lon = center

    groups = []
    for tag in interests:
        places = _fetch_places(tag, lat, lon, radius_m)
        landmarks = [
            {
                "name": p.get("name") or p.get("formatted") or "Unnamed place",
                "category": (p.get("categories") or [tag])[0],
                "lat": p["lat"],
                "lon": p["lon"],
                "address": p.get("formatted"),
                "distance_m": round(_haversine_m(lat, lon, p["lat"], p["lon"])),
            }
            for p in places
        ]
        landmarks.sort(key=lambda l: l["distance_m"])
        groups.append(
            {
                "interest": tag,
                "explanation": f"Nearby matches for your interest in {tag}, sorted by distance.",
                "landmarks": landmarks,
            }
        )

    return {"destination": destination, "groups": groups, "error": None}
