import pytest

import engine.currency as currency
from engine.scorers import (
    score_accessibility,
    score_budget,
    score_climate,
    score_interests,
    score_safety,
)


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


# --- score_safety --------------------------------------------------------


def test_safety_missing_is_neutral(destinations, prefs_factory):
    prefs = prefs_factory()
    result = score_safety(prefs, destinations["mid_no_climate_data"], "country")
    assert result.value == 0.5


def test_safety_reflects_index(destinations, prefs_factory):
    prefs = prefs_factory()
    safe = score_safety(prefs, destinations["mid_safe_interest_rich"], "country")
    unsafe = score_safety(prefs, destinations["mid_unsafe"], "country")
    assert safe.value > unsafe.value
