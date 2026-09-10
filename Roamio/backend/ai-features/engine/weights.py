from __future__ import annotations

# weights per level, need to add up to 1.0 for each level - test_weights.py checks this
# so a typo here fails the test suite instead of quietly messing up scores
#
# basic idea: nobody skips a whole country because one museum has no ramp access.
# budget/climate/safety matter more at the country level, interests/accessibility
# matter more once you're picking a specific city
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

# bottom-up blend: country_score = BLEND_SELF * own features
#                                 + BLEND_CHILDREN * mean(top-N child scores)
# without this a country could rank #1 on cost/climate and then every city
# inside it fails the user's accessibility needs - kind of a dead end
BLEND_SELF_WEIGHT = 0.7
BLEND_CHILDREN_WEIGHT = 0.3
BLEND_TOP_N_CHILDREN = 3

# Results are ranked across the full candidate set before these limits are
# applied. The floor becomes stricter as the user supplies more constraints.
MAX_RESULTS: dict[str, int] = {"country": 6, "city": 8, "place": 8}
BASE_RELEVANCE_FLOOR = 0.40

# hand-curated 1..5 cost_index -> rough daily cost band in ZAR, used by the
# budget gate and score_budget. Went with ZAR here since that's what the sample
# request and Node's Trip.budget model both use - not based on any real currency
# spec, just what was already in use. If prefs.currency isn't ZAR, engine/currency.py
# converts these bounds through ExchangeRate-API before comparing to budget_per_day.
#
# gate checks against the floor of the band, not the ceiling - band 5 has no
# ceiling (2500+) so gating on that would exclude everyone in band 5 no matter
# their budget. checking the floor answers the actual question: can they even
# afford the cheapest version of this place
COST_BAND_ZAR_RANGE: dict[int, tuple[float, float]] = {
    1: (0.0, 500.0),
    2: (500.0, 900.0),
    3: (900.0, 1500.0),
    4: (1500.0, 2500.0),
    5: (2500.0, float("inf")),
}

# accessibility gate: "required" + "poor" gets excluded. "unknown" does NOT
# get excluded on purpose - a place with barely any OSM tags isn't proof it's
# actually inaccessible, that would be unfair to places that just aren't well mapped
ACCESSIBILITY_HARD_FAIL_STATE = "poor"

# climate scoring curve used in score_climate. compares the candidate's average
# temp for the travel month against these target values, the further off it is
# (up to the tolerance) the lower the score. there's no hard climate gate, just
# this soft scoring based on the "prefer" setting
CLIMATE_TARGET_C: dict[str, float] = {"cold": 10.0, "mild": 20.0, "hot": 30.0}
CLIMATE_TOLERANCE_C = 15.0
