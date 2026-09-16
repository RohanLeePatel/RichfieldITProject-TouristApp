"""
~10 made-up city destinations covering cheap/expensive, accessible/untagged/poor,
hot/cold, interest-rich/interest-poor. All fake data, no network calls, so tests
stay fast and deterministic.
"""

from __future__ import annotations

import pytest

from schemas.recommendations import (
    Accessibility,
    Candidate,
    CandidateFeatures,
    ClimateNormals,
    ClimatePrefs,
    Preferences,
    Travellers,
)


def make_candidate(
    id: str,
    name: str,
    *,
    cost_index: int | None = 3,
    accessibility: str = "unknown",
    accessible_ratio: float | None = None,
    tagged_total: int = 0,
    interest_density: dict | None = None,
    interest_counts: dict | None = None,
    family_poi_density: float | None = None,
    avg_temp_by_month: dict | None = None,
    safety_index: float | None = None,
    children: list | None = None,
) -> Candidate:
    return Candidate(
        id=id,
        name=name,
        features=CandidateFeatures(
            cost_index=cost_index,
            accessibility=accessibility,
            accessible_ratio=accessible_ratio,
            tagged_total=tagged_total,
            interest_density=interest_density or {},
            interest_counts=interest_counts or {},
            family_poi_density=family_poi_density,
            climate=ClimateNormals(avg_temp_by_month=avg_temp_by_month) if avg_temp_by_month else None,
            safety_index=safety_index,
        ),
        children=children or [],
    )


@pytest.fixture
def destinations() -> dict[str, Candidate]:
    return {
        "cheap_accessible_historic": make_candidate(
            "d1", "Cheap Accessible Historic City",
            cost_index=1, accessibility="supported", accessible_ratio=0.9, tagged_total=50,
            interest_density={"history": 0.9, "food": 0.5}, interest_counts={"history": 40, "food": 15},
            avg_temp_by_month={"12": 20.0}, safety_index=0.9,
        ),
        "expensive_untagged_beach": make_candidate(
            "d2", "Expensive Untagged Beach City",
            cost_index=5, accessibility="unknown", tagged_total=2,
            interest_density={"nature": 0.8}, interest_counts={"nature": 20},
            avg_temp_by_month={"12": 32.0},
        ),
        "mid_poor_access_nightlife": make_candidate(
            "d3", "Mid Poor-Access Nightlife City",
            cost_index=3, accessibility="poor", accessible_ratio=0.05, tagged_total=40,
            interest_density={"nightlife": 0.7, "food": 0.6}, interest_counts={"nightlife": 30, "food": 25},
            avg_temp_by_month={"12": 22.0},
        ),
        "cheap_interest_poor_cold": make_candidate(
            "d4", "Cheap Interest-Poor Cold City",
            cost_index=1, accessibility="unknown", tagged_total=1,
            interest_density={"history": 0.05, "nature": 0.05}, interest_counts={"history": 1, "nature": 1},
            avg_temp_by_month={"12": -5.0},
        ),
        "expensive_accessible_family": make_candidate(
            "d5", "Expensive Accessible Family City",
            cost_index=5, accessibility="supported", accessible_ratio=0.85, tagged_total=60,
            interest_density={"family": 0.8, "nature": 0.6}, interest_counts={"family": 35, "nature": 20},
            family_poi_density=0.85, avg_temp_by_month={"12": 21.0},
        ),
        "mid_safe_interest_rich": make_candidate(
            "d6", "Mid Safe Interest-Rich City",
            cost_index=3, accessibility="unknown", tagged_total=3,
            interest_density={"history": 0.85, "nature": 0.8}, interest_counts={"history": 45, "nature": 30},
            safety_index=0.9, avg_temp_by_month={"12": 19.0},
        ),
        "mid_unsafe": make_candidate(
            "d7", "Mid Unsafe City",
            cost_index=3, accessibility="unknown", tagged_total=3,
            interest_density={"history": 0.5}, interest_counts={"history": 10},
            safety_index=0.1, avg_temp_by_month={"12": 20.0},
        ),
        "cheap_hot": make_candidate(
            "d8", "Cheap Hot City",
            cost_index=1, accessibility="unknown", tagged_total=1,
            interest_density={"nature": 0.4}, interest_counts={"nature": 8},
            avg_temp_by_month={"12": 35.0},
        ),
        "expensive_poor_access_historic": make_candidate(
            "d9", "Expensive Poor-Access Historic City",
            cost_index=5, accessibility="poor", accessible_ratio=0.02, tagged_total=45,
            interest_density={"history": 0.9}, interest_counts={"history": 40},
            avg_temp_by_month={"12": 18.0},
        ),
        "mid_no_climate_data": make_candidate(
            "d10", "Mid No-Climate-Data City",
            cost_index=3, accessibility="unknown", tagged_total=0,
            interest_density={"food": 0.6}, interest_counts={"food": 12},
        ),
    }


def make_prefs(
    *,
    budget_per_day: float = 1000.0,
    currency: str = "ZAR",
    interests: list[str] | None = None,
    priority_interests: list[str] | None = None,
    adults: int = 2,
    children: list[int] | None = None,
    wheelchair: str = "none",
    climate_prefer: str | None = None,
    travel_month: int | None = 12,
    travel_month_end: int | None = None,
) -> Preferences:
    return Preferences(
        budget_per_day=budget_per_day,
        currency=currency,
        interests=interests or ["history"],
        priority_interests=priority_interests or [],
        travellers=Travellers(adults=adults, children=children or []),
        accessibility=Accessibility(wheelchair=wheelchair),
        climate=ClimatePrefs(prefer=climate_prefer, travel_month=travel_month, travel_month_end=travel_month_end),
    )


@pytest.fixture
def prefs_factory():
    return make_prefs
