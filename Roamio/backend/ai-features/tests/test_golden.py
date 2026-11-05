"""
Golden tests for the two things that must not change by accident: the shape of
the API (OpenAPI snapshot) and which destinations come out on top for a set of
typical travellers (ranking snapshot).

If one of these fails after a change you MEANT to make, look at the diff, and if
it is what you wanted, regenerate the file and commit it with the change:

    UPDATE_GOLDEN=1 python -m pytest tests/test_golden.py

That diff in the pull request is the review: it shows exactly which rankings
moved when someone retuned engine/weights.py. Raise WEIGHTS_VERSION with it.
"""

import json
import os
from pathlib import Path

import pytest

import main
from engine.catalog import load_city_candidates, load_country_catalog
from engine.pipeline import build_response
from schemas.recommendations import RecommendationRequest

HERE = Path(__file__).resolve().parent
RANKINGS = HERE / "golden_rankings.json"
OPENAPI = HERE / "openapi.snapshot.json"
UPDATE = bool(os.environ.get("UPDATE_GOLDEN"))


def prefs(**changes):
    base = {
        "budget_per_day": 1200,
        "currency": "ZAR",
        "interests": ["history", "nature", "food"],
        "travellers": {"adults": 2},
        "accessibility": {"wheelchair": "none"},
        "climate": {"travel_month": 12},
        "pace": "balanced",
    }
    return {**base, **changes}


# name -> (level, parent_id, preferences). All ZAR so no exchange-rate call is made.
SCENARIOS = {
    "country, modest budget, culture": ("country", None, prefs(budget_per_day=900, interests=["history", "museums", "food"])),
    "country, big budget, beaches": ("country", None, prefs(budget_per_day=4000, interests=["beaches", "food", "nature"])),
    "country, family in June": ("country", None, prefs(interests=["family", "parks", "beaches"], climate={"travel_month": 6, "prefer": "mild"})),
    "country, wheelchair user": ("country", None, prefs(budget_per_day=2500, accessibility={"wheelchair": "required"})),
    "cities in South Africa, outdoors": ("city", "south-africa", prefs(interests=["hiking", "nature", "beaches"])),
    "cities in South Africa, food": ("city", "south-africa", prefs(interests=["restaurants", "cafes", "street_food"])),
    "cities in Spain, history": ("city", "spain", prefs(budget_per_day=2000, interests=["history", "museums", "historic_sites"])),
    "cities in Japan, cold month": ("city", "japan", prefs(budget_per_day=3000, climate={"travel_month": 1, "prefer": "cold"})),
}


def run(level, parent, preferences):
    request = RecommendationRequest.model_validate(
        {
            "request_id": "11111111-1111-1111-1111-111111111111",
            "session_id": "22222222-2222-2222-2222-222222222222",
            "level": level,
            "parent_id": parent,
            "preferences": preferences,
        }
    )
    candidates = load_country_catalog() if level == "country" else load_city_candidates(country_id=parent)
    response = build_response(request, candidates=candidates)
    return [[r.id, round(r.total_score, 3)] for r in response.results]


def check(path: Path, actual, what: str):
    text = json.dumps(actual, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if UPDATE or not path.exists():
        path.write_text(text, encoding="utf-8")
        if not UPDATE:
            pytest.fail(f"{path.name} did not exist, so it was written. Review and commit it.")
        return
    expected = path.read_text(encoding="utf-8")
    assert text == expected, (
        f"{what} changed. If that was intended, run `UPDATE_GOLDEN=1 python -m pytest tests/test_golden.py` "
        f"and commit the new {path.name} with your change."
    )


def test_typical_travellers_still_get_the_same_top_destinations():
    check(RANKINGS, {name: run(*scenario) for name, scenario in SCENARIOS.items()}, "The rankings")


def test_the_api_contract_has_not_changed_by_accident():
    # The Core API's proxies (and their selfchecks) are written against this, so a
    # change here is a change the Core API may need to follow.
    check(OPENAPI, main.app.openapi(), "The API contract")
