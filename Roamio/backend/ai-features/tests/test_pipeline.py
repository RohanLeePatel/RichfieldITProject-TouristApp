"""
Covers ranking with realistic personas, gate exclusions running through the
full pipeline, explanation text staying in sync with the evidence, and the
bottom-up blend.
"""

import pytest

from engine.group import merge_preferences
from engine.pipeline import score_candidates
from engine.weights import MAX_RESULTS
from tests.conftest import make_candidate, make_prefs

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


def test_relevance_floor_is_relative_not_absolute(prefs_factory):
    """
    A niche interest that scores low everywhere in absolute terms should still
    return the best candidates it has, not come back empty just because
    nothing clears some fixed absolute threshold.
    """
    many_mediocre = [
        make_candidate(f"m{i}", f"Mediocre City {i}", interest_density={"waterparks": 0.1})
        for i in range(MAX_RESULTS["city"] + 5)
    ]
    prefs = prefs_factory(interests=["waterparks"])
    results, excluded, _ = score_candidates(prefs, "city", many_mediocre)
    assert len(results) > 0
    assert len(results) + len(excluded) == len(many_mediocre)


def test_a_candidate_with_no_weighted_dimension_scores_neutral(monkeypatch, destinations, prefs_factory):
    """Guard against a divide-by-zero if every dimension is zero-weighted."""
    import engine.pipeline as pipeline_module
    from engine.dimension import DimensionScore

    monkeypatch.setattr(
        pipeline_module,
        "score_all_dimensions",
        lambda prefs, candidate, level: [
            DimensionScore(dimension="budget", value=0.9, weight=0.0, explanation="x")
        ],
    )

    score, breakdown = pipeline_module.score_candidate_own(
        prefs_factory(), destinations["cheap_accessible_historic"], "city"
    )
    assert score == 0.5
    assert [e.weight for e in breakdown] == [0.0]


# --- rank order must match the scores printed beside it -------------------


def test_rank_order_always_follows_score(prefs_factory):
    """
    The diversity rule below chooses which candidates make the page. It used
    to decide their order too, which published rank badges that contradicted
    the scores next to them - live, a 33% match sat at #4 above a 47% one.
    Whatever the selection does, rank 1..N must descend by score.
    """
    # Several strong candidates dominated by one interest, plus a weaker one
    # dominated by another - exactly the shape that triggers the variety pick.
    candidates = [
        make_candidate(f"parky-{i}", f"Parks City {i}", cost_index=1, interest_density={"parks": 0.9 - i * 0.01})
        for i in range(6)
    ] + [
        make_candidate("foodie", "Weak Food City", cost_index=5, interest_density={"restaurants": 0.95})
    ]
    prefs = prefs_factory(interests=["parks", "restaurants"], budget_per_day=800)

    results, _, _ = score_candidates(prefs, "city", candidates)

    scores = [r.total_score for r in results]
    assert scores == sorted(scores, reverse=True), f"ranks contradict scores: {scores}"
    assert [r.rank for r in results] == list(range(1, len(results) + 1))


def test_a_variety_pick_is_ranked_by_its_score_not_by_when_it_was_chosen(prefs_factory):
    """
    The exact live defect. The diversity rule reaches past the leaders to pull
    in a candidate with a different strongest interest; it used to land wherever
    the loop happened to place it, which was near the top. A 32% match was
    published at #4, above 47% ones. It belongs on the page - at its own rank.
    """
    parks = [
        make_candidate(f"p{i}", f"Parks City {i}", cost_index=1, interest_density={"parks": 0.95})
        for i in range(MAX_RESULTS["city"] + 4)
    ]
    weak_outlier = make_candidate("foodie", "Food City", cost_index=4, interest_density={"restaurants": 0.95})
    prefs = prefs_factory(interests=["parks", "restaurants"], budget_per_day=2000)

    results, excluded, _ = score_candidates(prefs, "city", [*parks, weak_outlier])

    shown = {r.id: r for r in results}
    assert "foodie" in shown, "variety pick should still make the page"
    # it is the weakest thing on the page, so it must be last
    assert shown["foodie"].rank == len(results)
    assert shown["foodie"].total_score == min(r.total_score for r in results)

    # and the parks cities it displaced are not described as merely low-ranked
    assert any("already cover" in item.reason for item in excluded), (
        f"variety drop never attributed: {[e.reason for e in excluded]}"
    )
    assert not any("Ranked below" in item.reason for item in excluded)


def test_explanations_across_one_response_are_not_all_identical(prefs_factory):
    """
    The live symptom: six results, six byte-identical sentences, because the
    highest-weighted dimension is the same one for every candidate scored
    against the same preferences.
    """
    candidates = [
        make_candidate("a", "Alpha", cost_index=2, interest_density={"parks": 0.95, "restaurants": 0.2}),
        make_candidate("b", "Beta", cost_index=2, interest_density={"parks": 0.2, "restaurants": 0.95}),
        make_candidate("c", "Gamma", cost_index=2, interest_density={"parks": 0.5, "restaurants": 0.5}),
    ]
    prefs = prefs_factory(interests=["parks", "restaurants"], budget_per_day=1000)

    results, _, _ = score_candidates(prefs, "city", candidates)
    explanations = [r.explanation for r in results]
    assert len(set(explanations)) > 1, f"every result explained identically: {explanations}"


# --- the group is scored as a group, not as one averaged traveller --------


def test_a_destination_that_fails_one_member_loses_to_one_that_suits_everybody():
    """
    The headline fix. Merging the group into a single Preferences first meant
    the union of everyone's interests was scored once, so a city matching one
    member brilliantly and the rest not at all looked like a group match.
    """
    museums_only = make_candidate(
        "museums", "Museum Town", cost_index=2,
        interest_density={"museums": 1.0, "beaches": 0.02, "hiking": 0.02},
    )
    something_for_all = make_candidate(
        "balanced", "Balanced Town", cost_index=2,
        interest_density={"museums": 0.65, "beaches": 0.65, "hiking": 0.65},
    )
    members = [
        make_prefs(label="Sipho", interests=["museums"]),
        make_prefs(label="Ayanda", interests=["beaches"]),
        make_prefs(label="Thandi", interests=["hiking"]),
    ]
    merged, _ = merge_preferences(members)

    results, _, _ = score_candidates(
        merged, "city", [museums_only, something_for_all], members=members
    )
    ranked = [r.id for r in results]
    assert ranked[0] == "balanced", f"one-sided city still won: {[(r.id, r.total_score) for r in results]}"


def test_each_result_reports_how_every_member_fared():
    members = [
        make_prefs(label="Sipho", interests=["museums"]),
        make_prefs(label="Ayanda", interests=["beaches"]),
    ]
    merged, _ = merge_preferences(members)
    candidate = make_candidate(
        "c", "Museum Town", cost_index=2, interest_density={"museums": 1.0, "beaches": 0.05}
    )

    results, _, _ = score_candidates(merged, "city", [candidate], members=members)
    fit = results[0].member_fit

    assert [f.label for f in fit] == ["Sipho", "Ayanda"]
    assert fit[0].score > fit[1].score, "the member it suits should score higher"
    assert results[0].fit_spread == pytest.approx(fit[0].score - fit[1].score)
    assert all(f.weakest_dimension for f in fit)


def test_a_solo_request_carries_no_member_breakdown():
    """Nobody to disagree with - the response should not imply a group."""
    prefs = make_prefs(interests=["museums"])
    candidate = make_candidate("c", "Town", cost_index=2, interest_density={"museums": 0.8})
    results, _, _ = score_candidates(prefs, "city", [candidate], members=[prefs])
    assert results[0].member_fit == []
    assert results[0].fit_spread is None


def test_group_scoring_still_ranks_by_score(prefs_factory):
    """The ordering guarantee has to survive the per-member path too."""
    members = [
        make_prefs(label="A", interests=["museums"]),
        make_prefs(label="B", interests=["beaches"]),
    ]
    merged, _ = merge_preferences(members)
    candidates = [
        make_candidate(f"c{i}", f"Town {i}", cost_index=2,
                       interest_density={"museums": 0.9 - i * 0.1, "beaches": 0.3 + i * 0.1})
        for i in range(5)
    ]
    results, _, _ = score_candidates(merged, "city", candidates, members=members)
    scores = [r.total_score for r in results]
    assert scores == sorted(scores, reverse=True)
