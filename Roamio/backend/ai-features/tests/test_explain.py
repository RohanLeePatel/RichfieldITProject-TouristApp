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


def test_identical_candidates_are_reported_as_a_tie_not_silence():
    """A dead heat is a real finding. Staying silent let the #1/#2 badges imply
    a difference the scores did not support."""
    breakdown = [entry("budget", 0.5, 0.5)]
    comparison = build_comparison("Lisbon", breakdown, "Porto", list(breakdown))
    assert comparison is not None
    assert "evenly" in comparison
    assert "arbitrary" in comparison
    assert "Lisbon" in comparison and "Porto" in comparison


def test_a_gap_too_small_to_matter_also_reads_as_a_tie():
    first = [entry("budget", 0.500, 0.5)]
    second = [entry("budget", 0.504, 0.5)]  # 0.2% apart - noise, not a reason
    assert "evenly" in build_comparison("Lisbon", first, "Porto", second)


# --- explanations have to distinguish, not just describe ------------------


def test_the_explanation_names_what_sets_this_candidate_apart_from_its_peers():
    """The regression that made every result read identically: budget carries
    the most weight, so the biggest-contribution rule picked it for every
    candidate scored against the same budget. With peers in view, the line has
    to name the dimension this one actually leads on."""
    peer = [entry("budget", 0.65, 0.45, "Cost band 2/5."), entry("interests", 0.30, 0.30, "Some parks.")]
    standout = [entry("budget", 0.65, 0.45, "Cost band 2/5."), entry("interests", 0.95, 0.30, "Loads of parks.")]

    assert build_explanation("Hanoi", standout) == "Hanoi: Cost band 2/5."
    assert build_explanation("Hanoi", standout, peers=[peer, peer]) == "Hanoi: Loads of parks."


def test_a_candidate_that_leads_on_nothing_admits_it():
    """Four live results tied exactly because interest density saturates at
    1.0 for many countries. Repeating the budget line for each implied a
    reason; the honest answer is that the data cannot separate them."""
    shared = [entry("budget", 0.65, 0.45, "Cost band 2/5."), entry("interests", 0.4, 0.3, "Some parks.")]
    line = build_explanation("Hanoi", shared, peers=[list(shared), list(shared)])
    assert line.startswith("Hanoi: Cost band 2/5.")
    assert "Nothing in the data separates it" in line


def test_without_peers_there_is_no_claim_about_separation():
    """A lone result has nothing to be separated from - don't assert either way."""
    shared = [entry("budget", 0.65, 0.45, "Cost band 2/5.")]
    assert build_explanation("Hanoi", shared) == "Hanoi: Cost band 2/5."


def test_peers_scored_on_a_dimension_this_candidate_lacks_are_ignored():
    """A dimension with no peer figures can't show a lead, and must not crash."""
    candidate = [entry("budget", 0.9, 0.5, "Very cheap.")]
    peers = [[entry("climate", 0.9, 0.5, "Warm.")]]
    assert build_explanation("Hanoi", candidate, peers=peers) == "Hanoi: Very cheap."


@pytest.mark.parametrize("value,weight", [(1.5, 0.5), (-0.1, 0.5), (0.5, 1.5), (0.5, -0.1)])
def test_a_score_outside_zero_to_one_is_refused(value, weight):
    """Guards the invariant the whole ranking rests on."""
    with pytest.raises(ValueError):
        DimensionScore(dimension="budget", value=value, weight=weight)


def test_a_candidate_that_simply_trails_is_not_called_inseparable():
    """Below the pack is not level with it. Claiming 'nothing separates it'
    for a candidate that loses on every dimension would be plainly false."""
    strong = [entry("budget", 0.9, 0.5, "Very cheap."), entry("interests", 0.9, 0.5, "Loads to do.")]
    weak = [entry("budget", 0.2, 0.5, "Pricey."), entry("interests", 0.2, 0.5, "Little to do.")]
    line = build_explanation("Laggard", weak, peers=[strong, list(strong)])
    assert "Nothing in the data separates it" not in line


def test_level_on_one_dimension_but_behind_on_another_is_not_a_tie():
    """The live near-miss: identical cost band, lower interest density. Tied
    on budget, behind overall - so no tie claim."""
    peer = [entry("budget", 0.65, 0.5, "Cost band 2/5."), entry("interests", 1.0, 0.5, "Saturated.")]
    behind = [entry("budget", 0.65, 0.5, "Cost band 2/5."), entry("interests", 0.6, 0.5, "Less on offer.")]
    line = build_explanation("Colombia", behind, peers=[peer, list(peer)])
    assert "Nothing in the data separates it" not in line
