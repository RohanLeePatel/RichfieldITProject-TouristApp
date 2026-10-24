"""
Country safety for the engine's safety dimension (scorers.score_safety), from
TravelRiskAPI's advisory levels - the same provider the Core API shows on the
trip page.

One request fetches every country's level (`/countries?limit=1000`), cached in
memory for 12 hours: TravelRiskAPI's free plan allows 100 requests a day, so a
per-candidate lookup would run out within a few recommendation runs. When the
provider fails the last levels we had are used; with none at all, candidates
keep safety_index None and the dimension isn't counted - missing data is never
read as "unsafe".
"""

from __future__ import annotations

import logging
import os

import requests

from cache_utils import ttl_cache_get, ttl_cache_set
from schemas.recommendations import Candidate

logger = logging.getLogger(__name__)

TRAVEL_RISK_API_KEY = os.environ.get("TRAVEL_RISK_API_KEY_1")
TRAVEL_RISK_API_URL = os.environ.get("TRAVEL_RISK_API_URL_1") or "https://travelriskapi.com/api/v1"
CACHE_TTL_SECONDS = 12 * 60 * 60
REQUEST_TIMEOUT_SECONDS = 5

# catalog country names where TravelRiskAPI's differ
NAME_ALIASES = {"czech republic": "czechia", "denmark": "kingdom of denmark"}

_levels_cache: dict[str, tuple[dict[str, int], float]] = {}


def advisory_levels() -> dict[str, int]:
    """Lower-cased country name -> advisory level 1 (normal) .. 4 (do not travel); {} if unknown."""
    cached = ttl_cache_get(_levels_cache, "levels", CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    stale = ttl_cache_get(_levels_cache, "levels", CACHE_TTL_SECONDS, allow_stale=True) or {}
    if not TRAVEL_RISK_API_KEY:
        return stale

    try:
        response = requests.get(
            f"{TRAVEL_RISK_API_URL}/countries",
            params={"limit": 1000},
            headers={"X-API-Key": TRAVEL_RISK_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        # {"total": 231, "data": [{"iso_code": "IDN", "name": "Indonesia", "advisory_level": 2, ...}]}
        levels = {
            row["name"].lower(): int(row["advisory_level"])
            for row in response.json().get("data", [])
            if row.get("name") and row.get("advisory_level")
        }
    except (requests.RequestException, ValueError, TypeError, KeyError) as error:
        logger.warning("TravelRiskAPI country levels unavailable: %s", error)
        return stale

    if not levels:
        return stale
    ttl_cache_set(_levels_cache, "levels", levels)
    return levels


def safety_index(country: str | None, levels: dict[str, int]) -> float | None:
    """Level 1 -> 1.0, 2 -> 0.67, 3 -> 0.33, 4 -> 0.0; None when the country isn't listed."""
    if not country:
        return None
    name = country.lower()
    level = levels.get(NAME_ALIASES.get(name, name))
    return None if level is None else round(1 - (min(max(level, 1), 4) - 1) / 3, 2)


def with_safety(candidates: list[Candidate]) -> list[Candidate]:
    """Fills safety_index where it's missing (children too), from the country's advisory level.

    Skipped when every candidate is in the same country (a city-level run): the
    same value on all of them separates nothing and only squeezes the
    dimensions that do - see the comment in scorers.score_safety.
    """
    if len({(c.country or c.name).lower() for c in candidates}) < 2:
        return candidates
    levels = advisory_levels()
    if not levels:
        return candidates

    def fill(candidate: Candidate) -> Candidate:
        index = candidate.features.safety_index
        if index is None:
            index = safety_index(candidate.country or candidate.name, levels)
        return candidate.model_copy(
            update={
                "features": candidate.features.model_copy(update={"safety_index": index}),
                "children": [fill(child) for child in candidate.children],
            }
        )

    return [fill(candidate) for candidate in candidates]
