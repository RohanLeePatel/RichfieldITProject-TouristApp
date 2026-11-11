"""Merge rules for several travellers' preferences (engine/group.py)."""

from __future__ import annotations

import pytest

from engine.group import (
    aggregate_scores,
    detect_conflicts,
    explain_merge,
    member_label,
    merge_preferences,
)
from schemas.recommendations import Accessibility, ClimatePrefs, Preferences, Travellers


def member(**overrides) -> Preferences:
    base = {
        "budget_per_day": 1000.0,
        "currency": "ZAR",
        "interests": [],
        "priority_interests": [],
        "avoid_interests": [],
        "travellers": Travellers(adults=1),
        "accessibility": Accessibility(),
        "climate": ClimatePrefs(),
        "pace": "balanced",
    }
    return Preferences(**{**base, **overrides})


def test_single_member_passes_through_untouched():
    only = member(interests=["museums"])
    merged, notes = merge_preferences([only])
    # equality, not identity: the solo path now applies the traveller's own
    # avoid list, so it returns an equal copy rather than the same object
    assert merged == only
    assert notes == {"merged": False, "member_count": 1}
    assert explain_merge(notes) is None


def test_empty_list_is_rejected():
    with pytest.raises(ValueError):
        merge_preferences([])


def test_budget_takes_the_lowest_not_the_mean():
    merged, notes = merge_preferences(
        [member(budget_per_day=3000.0), member(budget_per_day=800.0), member(budget_per_day=1500.0)]
    )
    assert merged.budget_per_day == 800.0
    assert notes["budget_per_day"]["rule"] == "lowest"


def test_interests_are_pooled_and_deduplicated_case_insensitively():
    merged, _ = merge_preferences(
        [member(interests=["Museums", "beaches"]), member(interests=["museums", "hiking"])]
    )
    assert merged.interests == ["museums", "beaches", "hiking"]


def test_one_members_must_have_becomes_the_groups_must_have():
    merged, _ = merge_preferences(
        [member(interests=["museums"]), member(interests=["hiking"], priority_interests=["hiking"])]
    )
    assert merged.priority_interests == ["hiking"]


def test_strictest_accessibility_need_wins_over_the_majority():
    merged, notes = merge_preferences(
        [
            member(accessibility=Accessibility(wheelchair="none")),
            member(accessibility=Accessibility(wheelchair="none")),
            member(accessibility=Accessibility(wheelchair="required")),
        ]
    )
    assert merged.accessibility.wheelchair == "required"
    assert notes["accessibility"]["rule"] == "strictest"


def test_traveller_count_comes_from_the_organiser_and_is_never_summed():
    # members are preference profiles for people already counted in the
    # organiser's party, so a second profile must not add a second head
    merged, notes = merge_preferences(
        [
            member(travellers=Travellers(adults=2, children=[7])),
            member(travellers=Travellers(adults=1, children=[4, 11])),
        ]
    )
    assert merged.travellers.adults == 2
    assert merged.travellers.children == [7]
    assert notes["travellers"]["rule"] == "organiser"


def test_climate_majority_wins():
    merged, _ = merge_preferences(
        [
            member(climate=ClimatePrefs(prefer="hot")),
            member(climate=ClimatePrefs(prefer="hot")),
            member(climate=ClimatePrefs(prefer="cold")),
        ]
    )
    assert merged.climate.prefer == "hot"


def test_climate_tie_falls_back_to_no_preference():
    merged, _ = merge_preferences(
        [member(climate=ClimatePrefs(prefer="hot")), member(climate=ClimatePrefs(prefer="cold"))]
    )
    assert merged.climate.prefer is None


def test_pace_tie_falls_back_to_balanced():
    merged, _ = merge_preferences([member(pace="packed"), member(pace="relaxed")])
    assert merged.pace == "balanced"


def test_travel_month_comes_from_the_organiser_not_a_vote():
    merged, _ = merge_preferences(
        [
            member(climate=ClimatePrefs(travel_month=3)),
            member(climate=ClimatePrefs(travel_month=11)),
            member(climate=ClimatePrefs(travel_month=11)),
        ]
    )
    assert merged.climate.travel_month == 3


def test_currency_comes_from_the_organiser():
    merged, _ = merge_preferences([member(currency="ZAR"), member(currency="USD")])
    assert merged.currency == "ZAR"


def test_explanation_names_the_rules_that_actually_changed_something():
    _, notes = merge_preferences(
        [
            member(budget_per_day=3000.0, interests=["museums"]),
            member(budget_per_day=600.0, accessibility=Accessibility(wheelchair="required")),
        ]
    )
    line = explain_merge(notes)
    assert "2 travellers" in line
    assert "lowest daily budget" in line
    assert "required" in line
    assert line.endswith(".")


# --- scoring a group without flattening it first --------------------------


def test_one_unhappy_member_costs_a_candidate_against_an_all_round_fit():
    """
    The whole point. Merging everyone into one traveller then scoring once
    could not tell these apart: the union of interests meant one person's
    match counted as the group's.
    """
    loved_by_most = aggregate_scores([0.95, 0.95, 0.95, 0.20])
    fine_for_all = aggregate_scores([0.72, 0.72, 0.72, 0.72])
    assert fine_for_all > loved_by_most


def test_aggregate_sits_between_the_mean_and_the_worst():
    scores = [0.9, 0.9, 0.3]
    mean = sum(scores) / len(scores)
    assert min(scores) < aggregate_scores(scores) < mean


def test_a_group_that_agrees_scores_exactly_what_it_agreed_on():
    assert aggregate_scores([0.6, 0.6, 0.6]) == pytest.approx(0.6)


def test_one_member_aggregates_to_itself():
    assert aggregate_scores([0.42]) == pytest.approx(0.42)


def test_aggregate_rejects_an_empty_group():
    with pytest.raises(ValueError):
        aggregate_scores([])


# --- naming the member a destination does not work for --------------------


def test_members_are_named_by_their_label_and_the_organiser_is_you():
    assert member_label(member(label="Ayanda"), 1) == "Ayanda"
    assert member_label(member(), 0) == "You"
    assert member_label(member(), 2) == "Traveller 3"
    assert member_label(member(label="   "), 1) == "Traveller 2"


# --- conflicts the group should be told about -----------------------------


def test_a_must_have_that_another_member_ruled_out_is_surfaced():
    conflicts = detect_conflicts([
        member(label="Sipho", interests=["museums"], priority_interests=["museums"]),
        member(label="Lerato", avoid_interests=["museums"]),
    ])
    assert any("Sipho" in c and "Lerato" in c and "museums" in c for c in conflicts)


def test_widely_different_budgets_are_surfaced_with_whose_limit_binds():
    conflicts = detect_conflicts([
        member(label="Thandi", budget_per_day=3000.0),
        member(label="Ayanda", budget_per_day=600.0),
    ])
    assert any("Ayanda" in c and "budget" in c.lower() for c in conflicts)


def test_a_group_that_agrees_reports_no_conflicts():
    assert detect_conflicts([
        member(label="A", interests=["parks"], budget_per_day=1000.0),
        member(label="B", interests=["parks"], budget_per_day=1100.0),
    ]) == []


def test_the_merge_carries_a_dealbreaker_instead_of_dropping_it():
    # The merge built its Preferences field by field and never mentioned
    # avoid_interests, so the field reverted to empty and the penalty in
    # score_interests could not fire however the request was filled in.
    merged, notes = merge_preferences([
        member(label="You", interests=["museums"], priority_interests=["museums"]),
        member(label="Lerato", interests=["beaches"], avoid_interests=["museums"]),
    ])
    assert merged.avoid_interests == ["museums"]
    # and the conflict line promises the tag "has been excluded", so it is
    assert "museums" not in merged.interests
    assert "museums" not in merged.priority_interests
    assert notes["avoid_interests"] == {"rule": "union", "chosen": ["museums"]}


def test_a_solo_traveller_keeps_their_own_avoid_list():
    merged, _ = merge_preferences([member(interests=["parks"], avoid_interests=["casinos"])])
    assert merged.avoid_interests == ["casinos"]


def test_a_solo_traveller_cannot_conflict_with_anyone():
    assert detect_conflicts([member(priority_interests=["museums"], avoid_interests=["museums"])]) == []
