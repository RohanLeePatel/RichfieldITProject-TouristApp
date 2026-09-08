from __future__ import annotations

# Per-level dimension weights. Must sum to 1.0 per level — enforced by
# test_weights.py, not at import time, so a bad edit fails fast in CI
# rather than at request time.
#
# Rationale (plan §3): nobody rejects a country because one museum lacks a
# ramp. Budget/climate/safety dominate high up; interests/accessibility
# dominate low down, where the user has already committed to a place.
WEIGHTS: dict[str, dict[str, float]] = {
    "country": {
        "budget": 0.30,
        "climate": 0.25,
        "safety": 0.25,
        "interests": 0.15,
        "accessibility": 0.05,
    },
    "city": {
        "interests": 0.35,
        "budget": 0.20,
        "accessibility": 0.20,
        "climate": 0.15,
        "safety": 0.10,
    },
    "place": {
        "interests": 0.45,
        "accessibility": 0.30,
        "budget": 0.25,
    },
}

# Bottom-up blend (§3): country_score = BLEND_SELF * own features
#                                       + BLEND_CHILDREN * mean(top-N child scores)
# Prevents dead-end funnels — e.g. ranking a country #1 on cost/climate only
# for every one of its cities to fail the user's accessibility needs.
BLEND_SELF_WEIGHT = 0.7
BLEND_CHILDREN_WEIGHT = 0.3
BLEND_TOP_N_CHILDREN = 3

# Manually curated 1..5 cost_index (§2) -> approximate daily cost band, in
# ZAR, used for the hard budget gate and score_budget. This is a
# placeholder: the plan never defines a currency-normalised numeric range
# for the index, and the sample request/Node's Trip.budget model both use
# ZAR, so ZAR was chosen as the working assumption. When prefs.currency
# isn't ZAR, engine/currency.py converts these bounds via ExchangeRate-API
# before either the gate or the scorer compares them to budget_per_day.
#
# Gating on the band's floor, not its ceiling: band 5 is open-ended
# (2500+), so gating on an infinite ceiling would exclude every band-5
# candidate regardless of budget. The right question for a hard gate is
# "is even the cheapest end of this band unaffordable?" — i.e. compare
# against the floor.
COST_BAND_ZAR_RANGE: dict[int, tuple[float, float]] = {
    1: (0.0, 500.0),
    2: (500.0, 900.0),
    3: (900.0, 1500.0),
    4: (1500.0, 2500.0),
    5: (2500.0, float("inf")),
}

# Accessibility gate (§3): "required" + "poor" is a hard exclude. "unknown"
# is deliberately NOT excluded — sparse OSM tagging is not evidence of
# inaccessibility (plan §9 open risk: "Accessibility scoring reads as
# discriminatory or wrong").
ACCESSIBILITY_HARD_FAIL_STATE = "poor"

# score_climate temperature comfort curve. A candidate's monthly average for
# prefs.climate.travel_month is compared to these target midpoints; distance
# from the midpoint (clamped to the tolerance) linearly reduces the score.
# No hard climate gate is implemented (see engine/gates.py docstring) —
# the plan's draft schema has no explicit numeric range to gate against,
# only this soft "prefer" enum.
CLIMATE_TARGET_C: dict[str, float] = {"cold": 10.0, "mild": 20.0, "hot": 30.0}
CLIMATE_TOLERANCE_C = 15.0
