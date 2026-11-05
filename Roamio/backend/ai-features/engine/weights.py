from __future__ import annotations

# Raise this and add a line below whenever any value in this file changes, so a
# difference in recommendations between two dates can be traced to a cause.
#   2026-11-05  first numbered version: weights as shipped for Phase 4
WEIGHTS_VERSION = "2026-11-05"

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
# converts these bounds through the exchange-rate provider before comparing to budget_per_day.
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

# score_interests: a tag the user flagged as priority_interests counts this many
# times as much as a regular one in the weighted geometric mean - missing a
# must-have tag should hurt a lot more than missing a nice-to-have one
PRIORITY_INTEREST_WEIGHT_MULTIPLIER = 2.0

# score_interests family fold-in: how much family_poi_density pulls the interest
# score, scaled by how much of the group is children (children / total travellers).
# base = fold-in weight with just one child along; scale = extra weight added as
# the group skews more toward kids (capped at base+scale when everyone's a kid)
FAMILY_FOLD_IN_BASE = 0.15
FAMILY_FOLD_IN_SCALE = 0.35


# ---------------------------------------------------------------------------
# Group aggregation
# ---------------------------------------------------------------------------

# How much the least happy member's score counts when combining a group's
# individual scores: group = (1 - w) * mean + w * min.
#
# At 0 this is a plain average, which is what merging everyone into one
# synthetic traveller amounted to: a destination three people love and one
# cannot afford beat a destination all four merely like. At 1 only the worst
# fit matters, which refuses to ever recommend anything with a weak spot.
# 0.4 is enough that one member's misery can cost a candidate the top slot
# without a single veto deciding the whole page.
GROUP_MISERY_WEIGHT = 0.4


# ---------------------------------------------------------------------------
# Travelling with children
# ---------------------------------------------------------------------------

# Ages were collected and then thrown away - only the number of children
# counted, so a toddler and a sixteen-year-old pulled the score identically.
# Each band names the interest tags that age actually uses; a child's presence
# lifts those tags rather than a generic "family" score.
#
# Upper bound is exclusive. Ages above the last band score as adults.
CHILD_AGE_BANDS: list[tuple[int, tuple[str, ...]]] = [
    (6, ("playgrounds", "parks", "zoos_aquariums")),
    (13, ("theme_parks", "zoos_aquariums", "playgrounds", "beaches")),
    (18, ("beaches", "theme_parks", "street_food", "museums")),
]

# A tag wanted by the children in the group is worth this much more in the
# interest mean, on top of any priority multiplier.
CHILD_INTEREST_WEIGHT_MULTIPLIER = 1.5


# ---------------------------------------------------------------------------
# Pace
# ---------------------------------------------------------------------------

# Pace was collected, merged, and then used only by the itinerary planner - it
# never reached destination scoring. It should: a group doing two things a day
# needs one category to be excellent, while a group doing five needs the whole
# spread to hold up.
#
# This blends the tolerant arithmetic mean of matched interest densities with
# the demanding geometric mean (which punishes any weak tag). Higher = stricter.
PACE_STRICTNESS: dict[str, float] = {"relaxed": 0.2, "balanced": 0.6, "packed": 1.0}


# ---------------------------------------------------------------------------
# Must-haves and dealbreakers
# ---------------------------------------------------------------------------

# A starred tag that a destination barely has should cap the whole interest
# score, not merely weigh twice as much inside an average. Below this density
# a must-have counts as unmet.
PRIORITY_INTEREST_MIN_DENSITY = 0.15
PRIORITY_INTEREST_UNMET_CEILING = 0.35

# Dealbreaker tags never reached the engine before (the browser stripped them
# from the request). A candidate that is mostly the thing someone asked to
# avoid loses this share of its interest score.
AVOID_INTEREST_PENALTY = 0.5


# ---------------------------------------------------------------------------
# Rainfall
# ---------------------------------------------------------------------------

# Climate scoring was temperature-only, so a warm month in the middle of a
# monsoon scored the same as a dry one. Rain is scored only where the seed has
# it; rows written before it was collected keep the temperature-only score.
#
# mm of rain in the travel month at or below COMFORTABLE scores full marks,
# at or above SOAKED scores zero, linear in between.
RAIN_COMFORTABLE_MM = 60.0
RAIN_SOAKED_MM = 350.0
# how much of the climate dimension rainfall accounts for when it is known
RAIN_SHARE_OF_CLIMATE = 0.35
