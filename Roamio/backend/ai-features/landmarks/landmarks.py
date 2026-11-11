"""
Looks up actual landmarks/POIs near a destination using Geoapify - the
"what to do once you've picked a place" part of itinerary planning.

This doesn't go through the scoring engine like the country/city stuff in
engine/pipeline.py - a single landmark doesn't have a budget or climate, so
it's just a geocode + Places lookup, grouped by whatever interests were asked for.

Same as currency.py and weather.py: if something fails (bad key, no result)
it comes back as an error message instead of throwing. Results get cached
in memory since geocoding/POIs barely change, and Geoapify's free tier is
shared across the whole account (see scripts/enrich_destinations.py).
"""

from __future__ import annotations

import logging
import math

import http_client
from config import settings
from landmarks.interest_categories import INTEREST_CATEGORY_MAP
from services.cache_utils import mark_failed, recently_failed, ttl_cache_get, ttl_cache_set

logger = logging.getLogger(__name__)

GEOAPIFY_API_KEY = settings.get("geoapifyAPIKey")
GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
PLACES_URL = "https://api.geoapify.com/v2/places"
REQUEST_TIMEOUT_SECONDS = 10
CACHE_TTL_SECONDS = 24 * 60 * 60
PLACES_LIMIT_PER_TAG = 10

# key -> (value, fetched_at_monotonic), same shape as currency.py's _rate_cache,
# shared across requests on purpose
_geocode_cache: dict[tuple[str, int], tuple[tuple[float, float], float]] = {}
_geocode_failures: dict[tuple[str, int], tuple[bool, float]] = {}
_places_cache: dict[tuple[str, str, int], tuple[list[dict], float]] = {}


def _fix_mojibake(text: str | None) -> str | None:
    """some place names come back double-encoded from Geoapify/OSM - a "'"
    turns into "â€™" because the original UTF-8 bytes got misread as cp1252
    somewhere upstream. re-encoding as cp1252 then decoding as utf-8 undoes
    that. safe to run on normal text too since it just falls back unchanged
    if the bytes aren't valid UTF-8."""
    if not text:
        return text
    # OSM names can be bare numbers (a place literally called "42"); Geoapify returns them as ints
    text = str(text)
    try:
        return text.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return text


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
    cached = ttl_cache_get(_geocode_cache, cache_key, CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    if recently_failed(_geocode_failures, cache_key):
        return None

    try:
        response = http_client.get(
            GEOCODE_URL,
            params={"text": destination, "limit": 1, "apiKey": GEOAPIFY_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        features = response.json().get("features", [])
    except Exception as e:
        # the URL carries the API key, so log the exception type only. An expired
        # entry is better than no answer while the provider is down (NFR-13).
        logger.warning("Geoapify geocode failed: %s", type(e).__name__)
        mark_failed(_geocode_failures, cache_key)
        return ttl_cache_get(_geocode_cache, cache_key, CACHE_TTL_SECONDS, allow_stale=True)

    if not features:
        mark_failed(_geocode_failures, cache_key)
        return None

    lon, lat = features[0]["geometry"]["coordinates"]
    ttl_cache_set(_geocode_cache, cache_key, (lat, lon))
    return (lat, lon)


def _fetch_places(tag: str, lat: float, lon: float, radius_m: int) -> list[dict]:
    cache_key = (f"{lat:.4f},{lon:.4f}", tag, radius_m)
    cached = ttl_cache_get(_places_cache, cache_key, CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    categories = INTEREST_CATEGORY_MAP.get(tag)
    if not categories:
        return []

    try:
        response = http_client.get(
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
    except Exception as e:
        logger.warning("Geoapify places failed for '%s': %s", tag, type(e).__name__)
        return ttl_cache_get(_places_cache, cache_key, CACHE_TTL_SECONDS, allow_stale=True) or []

    ttl_cache_set(_places_cache, cache_key, places)
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
        landmarks = []
        seen = set()
        for p in places:
            # an unnamed OSM park would otherwise be titled with its address
            # ("Greyville, Durban, ...") - it reads as a suburb, and two unnamed
            # patches in one suburb become identical stops. Skip them.
            if not p.get("name"):
                continue
            name = _fix_mojibake(p["name"])
            key = (name.lower(), round(p["lat"], 3), round(p["lon"], 3))
            if key in seen:
                continue
            seen.add(key)
            landmarks.append(
                {
                    "name": name,
                    "category": (p.get("categories") or [tag])[0],
                    "lat": p["lat"],
                    "lon": p["lon"],
                    # address_line2 is the address without the name in front of it
                    "address": _fix_mojibake(p.get("address_line2") or p.get("formatted")),
                    "distance_m": round(_haversine_m(lat, lon, p["lat"], p["lon"])),
                    "opening_hours": p.get("opening_hours") or p.get("datasource", {}).get("raw", {}).get("opening_hours"),
                }
            )
        landmarks.sort(key=lambda place: place["distance_m"])
        groups.append(
            {
                "interest": tag,
                "explanation": f"Nearby matches for your interest in {tag.replace('_', ' ')}, sorted by distance.",
                "landmarks": landmarks,
            }
        )

    return {"destination": destination, "groups": groups, "error": None}


# results too coarse to be a stop, and fuzzy matches (Geoapify scores them 0)
_COARSE_RESULT_TYPES = {"country", "state", "county", "postcode"}
MIN_MATCH_CONFIDENCE = 0.5
PLACE_SEARCH_RADIUS_M = 30000


def search_place(text: str, near: str, radius_m: int = PLACE_SEARCH_RADIUS_M, lat: float | None = None, lon: float | None = None) -> dict:
    """Finds the named place within `radius_m` of `near` (a city, or lat/lon when
    the caller has a closer anchor, such as an existing stop). `found` is False
    when nothing credible is that close - never a guess from further away."""
    if not GEOAPIFY_API_KEY:
        return {"found": False, "error": "Place search error: geoapifyAPIKey is not configured."}

    if lat is None or lon is None:
        center = geocode_destination(near, radius_m)
        if center is None:
            return {"found": False, "error": f'Could not locate "{near}".'}
        lat, lon = center

    try:
        response = http_client.get(
            GEOCODE_URL,
            params={
                "text": text,
                "filter": f"circle:{lon},{lat},{radius_m}",
                "bias": f"proximity:{lon},{lat}",
                "limit": 1,
                "apiKey": GEOAPIFY_API_KEY,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        features = response.json().get("features", [])
    except Exception as e:
        # the URL carries the API key, so log the exception type only
        logger.warning("Geoapify place search failed: %s", type(e).__name__)
        return {"found": False, "error": "Place search is unavailable right now."}

    if not features:
        return {"found": False, "error": None}
    props = features[0]["properties"]
    confidence = (props.get("rank") or {}).get("confidence")
    if (confidence is not None and confidence < MIN_MATCH_CONFIDENCE) or props.get("result_type") in _COARSE_RESULT_TYPES:
        return {"found": False, "error": None}

    place_lat, place_lon = props["lat"], props["lon"]
    return {
        "found": True,
        "name": _fix_mojibake(props.get("name") or props.get("address_line1") or text),
        "address": _fix_mojibake(props.get("formatted")),
        "lat": place_lat,
        "lon": place_lon,
        "distance_m": round(_haversine_m(lat, lon, place_lat, place_lon)),
        "error": None,
    }
