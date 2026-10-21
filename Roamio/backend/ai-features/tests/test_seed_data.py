"""
Makes sure the committed seed data actually validates against our schema and
can be scored end to end. Catches it if enrich_destinations.py's output shape
ever drifts from schemas/recommendations.py, without needing to hit the real
Geoapify/Open-Meteo APIs.
"""

import json
from pathlib import Path

from engine.pipeline import score_candidates
from schemas.recommendations import Candidate
from tests.conftest import make_prefs

SEED_PATH = Path(__file__).resolve().parent.parent / "data" / "destinations_seed.json"


def _load_seed_candidates() -> list[Candidate]:
    raw = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    return [Candidate.model_validate(c) for c in raw]


def test_seed_file_exists():
    assert SEED_PATH.exists(), "Run scripts/enrich_destinations.py to generate seed data."


def test_seed_candidates_validate_against_contract():
    candidates = _load_seed_candidates()
    assert len(candidates) >= 1


def test_seed_candidates_score_without_error():
    candidates = _load_seed_candidates()
    prefs = make_prefs(budget_per_day=2000, interests=["history", "nature"], travel_month=6)
    results, excluded, _ = score_candidates(prefs, "city", candidates)
    assert len(results) + len(excluded) == len(candidates)
    for result in results:
        assert 0.0 <= result.total_score <= 1.0


def test_seed_sparse_accessibility_never_reads_as_poor():
    """catches the Durban/Windhoek case - 0 tagged POIs should read as
    'unknown', never 'poor'"""
    candidates = _load_seed_candidates()
    for c in candidates:
        if c.features.tagged_total < 5:
            assert c.features.accessibility != "poor", (
                f"{c.name} has only {c.features.tagged_total} tagged POIs but reads as 'poor'"
            )
