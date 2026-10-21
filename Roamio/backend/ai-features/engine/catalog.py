"""
Fallback candidate list so someone can just send preferences without already
knowing which countries/cities to score.

All from data/destinations_seed.json (see scripts/enrich_destinations.py),
nothing live here. There's no separate country-level dataset - country
candidates get built on the fly by grouping the cities by their `country` field.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from schemas.recommendations import Candidate

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "destinations_seed.json"


def slugify_country(name: str) -> str:
    return name.lower().replace(" ", "-")


@lru_cache(maxsize=1)
def _load_raw_seed() -> list[dict]:
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def load_city_candidates(country_id: str | None = None) -> list[Candidate]:
    raw = _load_raw_seed()
    if country_id is not None:
        raw = [c for c in raw if slugify_country(c["country"]) == country_id]
    return [Candidate.model_validate(c) for c in raw]


def load_country_catalog() -> list[Candidate]:
    raw = _load_raw_seed()
    by_country: dict[str, list[dict]] = {}
    for city in raw:
        by_country.setdefault(city["country"], []).append(city)

    countries: list[Candidate] = []
    for country_name, cities in by_country.items():
        children = [Candidate.model_validate(c) for c in cities]

        cost_indexes = [c["features"]["cost_index"] for c in cities if c["features"].get("cost_index") is not None]
        safety_indexes = [c["features"]["safety_index"] for c in cities if c["features"].get("safety_index") is not None]

        months: dict[str, list[float]] = {}
        rain_months: dict[str, list[float]] = {}
        for c in cities:
            climate = c["features"].get("climate") or {}
            for month, temp in climate.get("avg_temp_by_month", {}).items():
                months.setdefault(month, []).append(temp)
            # aggregated alongside temperature, or country-level scoring would
            # silently keep using temperature only
            for month, rain in climate.get("avg_rain_mm_by_month", {}).items():
                rain_months.setdefault(month, []).append(rain)

        # Without this, a country candidate's own interest_density/counts stay
        # empty and its "interests" dimension only ever shows up diluted through
        # the bottom-up blend (engine/weights.py BLEND_CHILDREN_WEIGHT) instead
        # of reflecting the country directly - same averaging idea as cost/safety
        # above, just per-tag.
        counts_by_tag: dict[str, list[int]] = {}
        density_by_tag: dict[str, list[float]] = {}
        for c in cities:
            for tag, count in (c["features"].get("interest_counts") or {}).items():
                counts_by_tag.setdefault(tag, []).append(count)
            for tag, density in (c["features"].get("interest_density") or {}).items():
                density_by_tag.setdefault(tag, []).append(density)

        interest_counts = {tag: sum(values) for tag, values in counts_by_tag.items()}
        interest_density = {tag: sum(values) / len(values) for tag, values in density_by_tag.items()}

        countries.append(
            Candidate(
                id=slugify_country(country_name),
                name=country_name,
                country=country_name,
                image_url=next((c.get("image_url") for c in cities if c.get("image_url")), None),
                features={
                    "cost_index": round(sum(cost_indexes) / len(cost_indexes)) if cost_indexes else None,
                    "safety_index": (sum(safety_indexes) / len(safety_indexes)) if safety_indexes else None,
                    "climate": (
                        {
                            "avg_temp_by_month": {
                                m: round(sum(t) / len(t), 1) for m, t in months.items()
                            },
                            "avg_rain_mm_by_month": {
                                m: round(sum(r) / len(r), 1) for m, r in rain_months.items()
                            },
                        }
                        if months
                        else None
                    ),
                    "interest_counts": interest_counts,
                    "interest_density": interest_density,
                    "family_poi_density": interest_density.get("family"),
                },
                children=children,
            )
        )
    return countries
