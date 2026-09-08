"""
Built-in candidate catalog: lets a caller ask for recommendations by
preferences alone, without already knowing which countries/cities to score.

Backed entirely by data/destinations_seed.json (see
scripts/enrich_destinations.py) — no live calls here. Country-level
candidates are synthesized from that same file's per-city `country` field;
there's no separate country dataset.
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
        for c in cities:
            for month, temp in (c["features"].get("climate") or {}).get("avg_temp_by_month", {}).items():
                months.setdefault(month, []).append(temp)

        countries.append(
            Candidate(
                id=slugify_country(country_name),
                name=country_name,
                features={
                    "cost_index": round(sum(cost_indexes) / len(cost_indexes)) if cost_indexes else None,
                    "safety_index": (sum(safety_indexes) / len(safety_indexes)) if safety_indexes else None,
                    "climate": (
                        {"avg_temp_by_month": {m: round(sum(t) / len(t), 1) for m, t in months.items()}}
                        if months
                        else None
                    ),
                },
                children=children,
            )
        )
    return countries
