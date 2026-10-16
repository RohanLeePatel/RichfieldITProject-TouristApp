"""Merge rules for several travellers' preferences (engine/group.py)."""

from __future__ import annotations

import pytest

from engine.group import explain_merge, merge_preferences
from schemas.recommendations import Accessibility, ClimatePrefs, Preferences, Travellers


def member(**overrides) -> Preferences:
    base = {
        "budget_per_day": 1000.0,
        "currency": "ZAR",
        "interests": [],
        "priority_interests": [],
        "travellers": Travellers(adults=1),
        "accessibility": Accessibility(),
        "climate": ClimatePrefs(),
        "pace": "balanced",
    }
    return Preferences(**{**base, **overrides})


def test_single_member_passes_through_untouched():
    only = member(interests=["museums"])
    merged, notes = merge_preferences([only])
    assert merged is only
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
