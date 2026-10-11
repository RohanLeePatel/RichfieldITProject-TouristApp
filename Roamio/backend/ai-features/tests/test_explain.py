"""The explanation facility (FR-17, FR-28, NFR-31): every result says why, and
says nothing it can't support."""

import pytest

from engine.dimension import DimensionScore
from engine.explain import build_comparison, build_explanation
from schemas.recommendations import EvidenceEntry


def entry(dimension, value, weight, explanation="because"):
    return EvidenceEntry(
        dimension=dimension, value=value, weight=weight, evidence={}, explanation=explanation
    )


def test_the_explanation_names_the_dimension_that_contributed_most():
    breakdown = [
        entry("budget", 0.2, 0.3, "Cheap enough."),
        entry("interests", 0.9, 0.5, "Lots of museums."),
    ]
    assert build_explanation("Lisbon", breakdown) == "Lisbon: Lots of museums."


def test_a_breakdown_with_no_weighted_dimension_explains_nothing():
    """Every dimension zero-weighted (the traveller expressed no preference at
    all) - say the name rather than invent a reason."""
    assert build_explanation("Lisbon", [entry("budget", 0.5, 0.0)]) == "'Lisbon'"


def test_the_comparison_reports_the_biggest_gap():
    first = [entry("interests", 0.9, 0.5), entry("budget", 0.5, 0.5)]
    second = [entry("interests", 0.3, 0.5), entry("budget", 0.6, 0.5)]
    comparison = build_comparison("Lisbon", first, "Porto", second)
    assert comparison.startswith("Lisbon ranked above Porto mainly on interests")


def test_no_comparison_when_the_two_share_no_dimensions():
    assert build_comparison("Lisbon", [entry("budget", 0.5, 0.5)], "Porto", [entry("safety", 0.5, 0.5)]) is None


def test_no_comparison_when_every_shared_dimension_is_unweighted():
    assert build_comparison("Lisbon", [entry("budget", 0.9, 0.0)], "Porto", [entry("budget", 0.1, 0.0)]) is None


def test_no_comparison_when_the_two_are_identical():
    breakdown = [entry("budget", 0.5, 0.5)]
    assert build_comparison("Lisbon", breakdown, "Porto", list(breakdown)) is None


@pytest.mark.parametrize("value,weight", [(1.5, 0.5), (-0.1, 0.5), (0.5, 1.5), (0.5, -0.1)])
def test_a_score_outside_zero_to_one_is_refused(value, weight):
    """Guards the invariant the whole ranking rests on."""
    with pytest.raises(ValueError):
        DimensionScore(dimension="budget", value=value, weight=weight)
