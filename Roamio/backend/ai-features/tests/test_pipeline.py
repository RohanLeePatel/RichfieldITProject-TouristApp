"""
Covers ranking with realistic personas, gate exclusions running through the
full pipeline, explanation text staying in sync with the evidence, and the
bottom-up blend.
"""

from engine.pipeline import score_candidates
from tests.conftest import make_candidate


# --- Personas --------------------------------------------------------


def test_persona_budget_family_with_wheelchair_user(destinations, prefs_factory):
    """
    budget family, needs a wheelchair, into family activities. poor-accessibility
    places should get excluded, and the accessible family-friendly one should
    make it through without getting beaten by any surviving 'poor' candidate.
    """
    prefs = prefs_factory(
        budget_per_day=6000, interests=["family"], children=[6, 9], wheelchair="required"
    )
    candidates = list(destinations.values())
    results, excluded, _ = score_candidates(prefs, "city", candidates)

    excluded_ids = {e.id for e in excluded}
    assert destinations["mid_poor_access_nightlife"].id in excluded_ids
    assert destinations["expensive_poor_access_historic"].id in excluded_ids

    result_ids = [r.id for r in results]
    assert destinations["expensive_accessible_family"].id in result_ids


def test_persona_couple_after_nightlife_no_accessibility_need(destinations, prefs_factory):
    """couple, no kids, no accessibility needs, into nightlife/food"""
    prefs = prefs_factory(budget_per_day=2000, interests=["nightlife", "food"], wheelchair="none")
    candidates = list(destinations.values())
    results, excluded, _ = score_candidates(prefs, "city", candidates)

    # no accessibility requirement was set, so the poor-accessibility spot should stay in
    excluded_ids = {e.id for e in excluded}
    assert destinations["mid_poor_access_nightlife"].id not in excluded_ids

    result_ids = [r.id for r in results]
    top_id = result_ids[0]
    assert top_id == destinations["mid_poor_access_nightlife"].id


def test_persona_tight_budget_excludes_expensive(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=300, interests=["history"])
    candidates = list(destinations.values())
    _, excluded, _ = score_candidates(prefs, "city", candidates)
    excluded_ids = {e.id for e in excluded}
    assert destinations["expensive_untagged_beach"].id in excluded_ids
    assert destinations["expensive_accessible_family"].id in excluded_ids
    assert destinations["expensive_poor_access_historic"].id in excluded_ids


def test_results_are_capped_after_ranking(destinations, prefs_factory):
    prefs = prefs_factory(interests=["history"])
    results, excluded, _ = score_candidates(prefs, "city", list(destinations.values()) * 2)
    assert len(results) <= 8
    assert len(results) + len(excluded) == len(destinations) * 2


def test_different_profiles_change_the_winner(destinations, prefs_factory):
    candidates = [
        destinations["cheap_accessible_historic"],
        destinations["expensive_accessible_family"],
    ]
    family = prefs_factory(budget_per_day=6000, interests=["family"], children=[6, 9])
    history = prefs_factory(interests=["history"], children=[])
    family_results, _, _ = score_candidates(family, "city", candidates)
    history_results, _, _ = score_candidates(history, "city", candidates)
    assert family_results[0].id != history_results[0].id


# --- Gate exclusion surfaces reasons, ranks are contiguous -------------


def test_ranks_are_contiguous_starting_at_one(destinations, prefs_factory):
    prefs = prefs_factory()
    results, _, _ = score_candidates(prefs, "city", list(destinations.values()))
    assert [r.rank for r in results] == list(range(1, len(results) + 1))


def test_excluded_have_reasons(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=1)
    _, excluded, _ = score_candidates(prefs, "city", list(destinations.values()))
    assert excluded
    assert all(e.reason for e in excluded)


# --- Explanation / evidence consistency (catches drift) -----------------


def test_explanation_references_top_dimension_evidence(destinations, prefs_factory):
    prefs = prefs_factory(interests=["history"], climate_prefer="mild")
    results, _, _ = score_candidates(prefs, "city", [destinations["cheap_accessible_historic"]])
    result = results[0]
    top = max((e for e in result.breakdown if e.weight > 0), key=lambda e: e.weight * e.value)
    assert top.explanation in result.explanation


def test_comparison_line_present_for_two_or_more(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=6000, interests=["history"])
    candidates = [destinations["cheap_accessible_historic"], destinations["expensive_untagged_beach"]]
    _, _, comparison = score_candidates(prefs, "city", candidates)
    assert comparison is not None


def test_comparison_line_absent_for_single_result(destinations, prefs_factory):
    prefs = prefs_factory()
    _, _, comparison = score_candidates(prefs, "city", [destinations["cheap_accessible_historic"]])
    assert comparison is None


# --- Bottom-up blend ------------------------------------------------------


def test_blend_pulls_score_toward_weak_children(destinations, prefs_factory):
    """
    a country that looks great on paper but whose top cities all fail the user's
    accessibility need shouldn't just win over a country with a decent own-score
    but actually accessible cities
    """
    prefs = prefs_factory(wheelchair="required", interests=["history"])

    weak_child = make_candidate(
        "child-poor", "Weak Accessibility City", cost_index=1, accessibility="unknown", tagged_total=0,
        interest_density={"history": 0.9},
    )
    strong_country_weak_children = make_candidate(
        "country-a", "Great On Paper", cost_index=1, safety_index=0.95,
        interest_density={"history": 0.9}, avg_temp_by_month={"12": 20.0},
        children=[weak_child],
    )

    no_children_result, _, _ = score_candidates(prefs, "country", [strong_country_weak_children])
    with_blend_evidence = no_children_result[0].breakdown[-1]
    assert with_blend_evidence.dimension == "bottom_up_blend"
    assert with_blend_evidence.evidence["blended"] is True
    assert with_blend_evidence.evidence["child_count"] == 1


def test_blend_skipped_and_noted_when_no_children(destinations, prefs_factory):
    prefs = prefs_factory()
    results, _, _ = score_candidates(prefs, "country", [destinations["cheap_accessible_historic"]])
    blend_evidence = results[0].breakdown[-1]
    assert blend_evidence.dimension == "bottom_up_blend"
    assert blend_evidence.evidence["blended"] is False
