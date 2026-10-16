import pytest

import engine.currency as currency
from engine.scorers import (
    score_accessibility,
    score_budget,
    score_climate,
    score_interests,
    score_safety,
    tags_for_children,
)
from engine.weights import PRIORITY_INTEREST_UNMET_CEILING
from tests.conftest import make_candidate, make_prefs

# --- score_budget ------------------------------------------------------


def test_budget_cheaper_scores_higher(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=1000)
    cheap = score_budget(prefs, destinations["cheap_accessible_historic"], "city")
    expensive = score_budget(prefs, destinations["expensive_untagged_beach"], "city")
    assert cheap.value > expensive.value


def test_budget_missing_cost_is_neutral(destinations, prefs_factory):
    prefs = prefs_factory()
    d = destinations["cheap_accessible_historic"]
    d.features.cost_index = None
    result = score_budget(prefs, d, "city")
    assert result.value == 0.5
    assert result.evidence["cost_index"] is None


def test_budget_converts_non_zar_currency(destinations, prefs_factory, monkeypatch):
    currency._rate_cache.clear()
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    monkeypatch.setattr(
        currency.requests,
        "get",
        lambda url, timeout: type(
            "R", (), {"raise_for_status": lambda self: None, "json": lambda self: {"result": "success", "conversion_rate": 0.055}}
        )(),
    )

    prefs = prefs_factory(budget_per_day=100, currency="USD")
    result = score_budget(prefs, destinations["cheap_accessible_historic"], "city")
    assert result.evidence["currency"] == "USD"
    # band 1's ZAR midpoint (250) at 0.055 conversion rate = 13.75 USD
    assert result.evidence["estimated_daily_cost"] == pytest.approx(13.75)


def test_budget_unavailable_conversion_is_neutral(destinations, prefs_factory, monkeypatch):
    currency._rate_cache.clear()
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", None)

    prefs = prefs_factory(currency="USD")
    result = score_budget(prefs, destinations["cheap_accessible_historic"], "city")
    assert result.value == 0.5
    assert result.evidence["currency_conversion"] == "unavailable"


# --- score_accessibility ------------------------------------------------


def test_accessibility_no_preference_zeroes_weight(destinations, prefs_factory):
    prefs = prefs_factory(wheelchair="none")
    result = score_accessibility(prefs, destinations["expensive_poor_access_historic"], "city")
    assert result.weight == 0.0


def test_accessibility_unknown_is_neutral_not_poor(destinations, prefs_factory):
    """sparse tagging should read as neutral, never as poor"""
    prefs = prefs_factory(wheelchair="preferred")
    result = score_accessibility(prefs, destinations["mid_no_climate_data"], "city")
    assert result.value == 0.5
    assert "sparse" in result.explanation.lower() or "neutral" in result.explanation.lower()


def test_accessibility_supported_scores_higher_than_poor(destinations, prefs_factory):
    prefs = prefs_factory(wheelchair="preferred")
    supported = score_accessibility(prefs, destinations["cheap_accessible_historic"], "city")
    poor = score_accessibility(prefs, destinations["expensive_poor_access_historic"], "city")
    assert supported.value > poor.value


# --- score_climate --------------------------------------------------------


def test_climate_no_preference_zeroes_weight(destinations, prefs_factory):
    prefs = prefs_factory(climate_prefer=None)
    result = score_climate(prefs, destinations["cheap_hot"], "city")
    assert result.weight == 0.0


def test_climate_matches_preference_scores_higher(destinations, prefs_factory):
    prefs = prefs_factory(climate_prefer="hot", travel_month=12)
    hot = score_climate(prefs, destinations["cheap_hot"], "city")
    cold = score_climate(prefs, destinations["cheap_interest_poor_cold"], "city")
    assert hot.value > cold.value


def test_climate_missing_data_is_neutral(destinations, prefs_factory):
    prefs = prefs_factory(climate_prefer="mild", travel_month=12)
    result = score_climate(prefs, destinations["mid_no_climate_data"], "city")
    assert result.value == 0.5


def test_climate_averages_across_month_range(prefs_factory):
    candidate = make_candidate(
        "clim1", "Two Season City", avg_temp_by_month={"6": 10.0, "7": 30.0}
    )
    prefs = prefs_factory(climate_prefer="mild", travel_month=6, travel_month_end=7)
    result = score_climate(prefs, candidate, "city")
    # target for "mild" is 20.0 - the average of 10 and 30 is exactly 20, a
    # perfect match, even though neither individual month is
    assert result.evidence["avg_temp_c"] == pytest.approx(20.0)
    assert result.value == pytest.approx(1.0)


def test_climate_wrapping_range_falls_back_to_start_month(prefs_factory):
    candidate = make_candidate("clim2", "Wrap City", avg_temp_by_month={"12": 20.0, "1": -10.0})
    # end (1) < start (12) - a year-wrapping range, not supported - falls back
    # to travel_month alone rather than misinterpreting the range
    prefs = prefs_factory(climate_prefer="mild", travel_month=12, travel_month_end=1)
    result = score_climate(prefs, candidate, "city")
    assert result.evidence["avg_temp_c"] == pytest.approx(20.0)


# --- score_interests --------------------------------------------------


def test_interests_rich_scores_higher_than_poor(destinations, prefs_factory):
    prefs = prefs_factory(interests=["history"])
    rich = score_interests(prefs, destinations["cheap_accessible_historic"], "city")
    poor = score_interests(prefs, destinations["cheap_interest_poor_cold"], "city")
    assert rich.value > poor.value


def test_multiple_interests_penalise_partial_matches(destinations, prefs_factory):
    prefs = prefs_factory(interests=["history", "nature"])
    full = score_interests(prefs, destinations["mid_safe_interest_rich"], "city")
    partial = score_interests(prefs, destinations["cheap_accessible_historic"], "city")
    assert full.value > partial.value


def test_interests_family_fold_in_only_applies_with_children(destinations, prefs_factory):
    candidate = destinations["expensive_accessible_family"]
    no_kids = score_interests(prefs_factory(interests=["family"], children=[]), candidate, "city")
    with_kids = score_interests(prefs_factory(interests=["family"], children=[5]), candidate, "city")
    # both start from the same base density, fold-in should only change things when there are kids
    assert with_kids.evidence["family_poi_density"] == 0.85
    assert no_kids.value == no_kids.evidence["matched_density"]["family"]


def test_interests_family_fold_in_scales_with_child_ratio(destinations, prefs_factory):
    candidate = destinations["expensive_accessible_family"]
    mostly_kids = score_interests(
        prefs_factory(interests=["family"], adults=1, children=[3, 5, 7]), candidate, "city"
    )
    mostly_adults = score_interests(
        prefs_factory(interests=["family"], adults=5, children=[10]), candidate, "city"
    )
    # a group that's mostly children should lean harder toward family_poi_density
    # than a group with just one child among several adults
    assert mostly_kids.value > mostly_adults.value


def test_priority_interest_weighted_higher_than_regular(destinations, prefs_factory):
    strong_on_priority = make_candidate(
        "px1", "Strong On Priority",
        interest_density={"history": 0.9, "nature": 0.1}, interest_counts={},
    )
    strong_on_regular = make_candidate(
        "px2", "Strong On Regular",
        interest_density={"history": 0.1, "nature": 0.9}, interest_counts={},
    )
    prefs = prefs_factory(interests=["history", "nature"], priority_interests=["history"])
    a = score_interests(prefs, strong_on_priority, "city")
    b = score_interests(prefs, strong_on_regular, "city")
    # same two raw density values (0.9/0.1) either way - only the priority flag
    # differs, so being strong on the flagged tag must score higher
    assert a.value > b.value


# --- score_safety --------------------------------------------------------


def test_safety_with_no_data_carries_no_weight(destinations, prefs_factory):
    """
    No safety source is wired up, so every seeded candidate has safety_index
    None. Scoring that 0.5 at the full country weight (0.25) handed every
    candidate the same contribution: it separated nothing, and shrank the
    dimensions that do separate into a smaller share of the total - enough to
    tie destinations that budget and interests would have split. An unmeasured
    dimension counts for nothing, exactly like climate and accessibility when
    the traveller states no preference.
    """
    prefs = prefs_factory()
    result = score_safety(prefs, destinations["mid_no_climate_data"], "country")
    assert result.value == 0.5
    assert result.weight == 0.0


def test_safety_that_is_known_still_counts(destinations, prefs_factory):
    prefs = prefs_factory()
    result = score_safety(prefs, destinations["mid_safe_interest_rich"], "country")
    assert result.weight > 0.0


def test_safety_reflects_index(destinations, prefs_factory):
    prefs = prefs_factory()
    safe = score_safety(prefs, destinations["mid_safe_interest_rich"], "country")
    unsafe = score_safety(prefs, destinations["mid_unsafe"], "country")
    assert safe.value > unsafe.value


def test_no_stated_interests_scores_neutral(destinations):
    """BR-08: a traveller who named no interests must not drag every candidate
    down on the interests dimension. Built directly rather than through
    prefs_factory, whose `interests or [...]` default can't express "none"."""
    from schemas.recommendations import Preferences, Travellers

    prefs = Preferences(
        budget_per_day=1000.0, currency="ZAR", interests=[], travellers=Travellers(adults=2)
    )
    score = score_interests(prefs, destinations["cheap_accessible_historic"], "city")
    assert score.value == 0.5
    assert "No interests stated" in score.explanation


# --- children's ages, not just how many there are -------------------------


def test_a_toddler_and_a_teenager_no_longer_score_the_same():
    """Ages were collected and then discarded - only len(children) counted."""
    playground_city = make_candidate(
        "c1", "Playground City", cost_index=2,
        interest_density={"playgrounds": 0.95, "museums": 0.2},
    )
    with_toddler = make_prefs(interests=["playgrounds", "museums"], children=[3])
    with_teenager = make_prefs(interests=["playgrounds", "museums"], children=[16])

    toddler_score = score_interests(with_toddler, playground_city, "city").value
    teen_score = score_interests(with_teenager, playground_city, "city").value
    assert toddler_score > teen_score


def test_age_bands_pick_out_the_tags_that_age_actually_uses():
    assert "playgrounds" in tags_for_children([4])
    assert "theme_parks" in tags_for_children([9])
    assert tags_for_children([]) == set()
    assert tags_for_children([25]) == set()  # above every band, scores as an adult


# --- pace reaches destination scoring at all ------------------------------


def test_pace_decides_how_much_a_weak_category_hurts():
    """
    Pace was merged and then used only by the itinerary planner. A group doing
    two things a day only needs one category to be excellent; a group doing
    five needs the spread to hold up.
    """
    lopsided = make_candidate(
        "c2", "One Great Thing", cost_index=2,
        interest_density={"museums": 1.0, "beaches": 0.05},
    )
    relaxed = score_interests(make_prefs(interests=["museums", "beaches"], pace="relaxed"), lopsided, "city")
    packed = score_interests(make_prefs(interests=["museums", "beaches"], pace="packed"), lopsided, "city")
    assert relaxed.value > packed.value


# --- must-haves actually bind ---------------------------------------------


def test_a_must_have_the_destination_barely_has_caps_the_score():
    """Doubling a starred tag's weight inside a mean still let a strong
    showing elsewhere carry a candidate past the one thing that was insisted on."""
    almost_no_museums = make_candidate(
        "c3", "Great Beaches No Museums", cost_index=1,
        interest_density={"beaches": 1.0, "museums": 0.10},
    )
    starred = make_prefs(interests=["beaches", "museums"], priority_interests=["museums"])
    unstarred = make_prefs(interests=["beaches", "museums"], pace="relaxed")

    starred_score = score_interests(starred, almost_no_museums, "city").value
    # the cap binds, and insisting on the missing thing must cost it something
    assert starred_score <= PRIORITY_INTEREST_UNMET_CEILING
    assert starred_score < score_interests(unstarred, almost_no_museums, "city").value


def test_a_must_have_that_is_met_is_not_capped():
    has_both = make_candidate(
        "c4", "Both", cost_index=1, interest_density={"beaches": 0.9, "museums": 0.8},
    )
    starred = make_prefs(interests=["beaches", "museums"], priority_interests=["museums"])
    assert score_interests(starred, has_both, "city").value > PRIORITY_INTEREST_UNMET_CEILING


# --- dealbreakers reach the engine ----------------------------------------


def test_a_destination_built_on_an_avoided_tag_is_penalised():
    """Dealbreakers were applied in the browser and stripped from the request,
    so the engine scored a place defined by the avoided thing exactly like one
    without it."""
    party_town = make_candidate(
        "c5", "Theme Park Town", cost_index=2,
        interest_density={"beaches": 0.8, "theme_parks": 1.0},
    )
    indifferent = make_prefs(interests=["beaches"])
    avoiding = make_prefs(interests=["beaches"], avoid_interests=["theme_parks"])
    assert score_interests(avoiding, party_town, "city").value < score_interests(indifferent, party_town, "city").value


def test_avoiding_something_the_destination_lacks_costs_it_nothing():
    quiet = make_candidate("c6", "Quiet Town", cost_index=2, interest_density={"beaches": 0.8})
    assert (
        score_interests(make_prefs(interests=["beaches"], avoid_interests=["theme_parks"]), quiet, "city").value
        == score_interests(make_prefs(interests=["beaches"]), quiet, "city").value
    )


# --- rainfall -------------------------------------------------------------


def test_a_wet_month_scores_below_a_dry_one_at_the_same_temperature():
    """Temperature alone called a warm month mid-monsoon a good month."""
    prefs = make_prefs(climate_prefer="hot", travel_month=1)
    dry = make_candidate("c7", "Dry", avg_temp_by_month={"1": 30.0})
    wet = make_candidate("c8", "Wet", avg_temp_by_month={"1": 30.0})
    dry.features.climate.avg_rain_mm_by_month = {"1": 20.0}
    wet.features.climate.avg_rain_mm_by_month = {"1": 400.0}
    assert score_climate(prefs, dry, "country").value > score_climate(prefs, wet, "country").value


def test_seed_rows_without_rainfall_keep_the_temperature_only_score():
    """Older rows must not be penalised for data that was never collected."""
    prefs = make_prefs(climate_prefer="hot", travel_month=1)
    no_rain_data = make_candidate("c9", "No Rain Data", avg_temp_by_month={"1": 30.0})
    result = score_climate(prefs, no_rain_data, "country")
    assert result.evidence["avg_rain_mm"] is None
    assert result.value == pytest.approx(1.0)
