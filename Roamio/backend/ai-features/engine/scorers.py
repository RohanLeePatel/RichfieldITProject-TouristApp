from __future__ import annotations

import math

from engine.currency import convert_from_zar
from engine.dimension import DimensionScore
from engine.weights import (
    CLIMATE_TARGET_C,
    CLIMATE_TOLERANCE_C,
    COST_BAND_ZAR_RANGE,
    WEIGHTS,
)
from schemas.recommendations import Candidate, Level, Preferences

# how much family_poi_density counts toward the interests score when kids are
# travelling and we actually have family POI data. kept fairly low so it doesn't
# drown out an otherwise strong interest match, but still nudges the ranking
FAMILY_FOLD_IN_WEIGHT = 0.25


def _base_weight(level: Level, dimension: str) -> float:
    return WEIGHTS[level].get(dimension, 0.0)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def score_budget(prefs: Preferences, candidate: Candidate, level: Level) -> DimensionScore:
    cost_index = candidate.features.cost_index
    weight = _base_weight(level, "budget")

    if cost_index is None:
        return DimensionScore(
            dimension="budget",
            value=0.5,
            weight=weight,
            evidence={"cost_index": None},
            explanation=f"No cost data available for '{candidate.name}'; treated as neutral.",
        )

    lower_bound_zar, upper_bound_zar = COST_BAND_ZAR_RANGE[cost_index]
    # band 5 has no upper bound, so just use the floor instead of trying to average
    # with infinity. every other band uses the midpoint like normal.
    representative_zar = (
        lower_bound_zar if upper_bound_zar == float("inf") else (lower_bound_zar + upper_bound_zar) / 2
    )
    representative = convert_from_zar(representative_zar, prefs.currency)

    if representative is None:
        # no API key or the lookup failed - same as the cost_index None case above,
        # just score it neutral instead of crashing or comparing wrong currencies
        return DimensionScore(
            dimension="budget",
            value=0.5,
            weight=weight,
            evidence={"cost_index": cost_index, "currency_conversion": "unavailable", "currency": prefs.currency},
            explanation=(
                f"Cost band {cost_index}/5 for '{candidate.name}' could not be converted "
                f"to {prefs.currency}; treated as neutral."
            ),
        )

    # cheaper = higher score. the gate already filtered out anything unaffordable,
    # so this is just ranking whatever's left
    value = _clamp01(1.0 - (representative / prefs.budget_per_day) * 0.5)

    return DimensionScore(
        dimension="budget",
        value=value,
        weight=weight,
        evidence={
            "cost_index": cost_index,
            "estimated_daily_cost": representative,
            "budget_per_day": prefs.budget_per_day,
            "currency": prefs.currency,
        },
        explanation=(
            f"Cost band {cost_index}/5 (~{representative:.0f} {prefs.currency}/day) "
            f"against your {prefs.budget_per_day:.0f} {prefs.currency}/day budget."
        ),
    )


def score_climate(prefs: Preferences, candidate: Candidate, level: Level) -> DimensionScore:
    base_weight = _base_weight(level, "climate")
    prefer = prefs.climate.prefer

    if prefer is None:
        # no preference set = weight goes to 0, not a middle score. the dimension
        # just doesn't count toward the total at all
        return DimensionScore(
            dimension="climate",
            value=0.5,
            weight=0.0,
            evidence={"prefer": None},
            explanation="No climate preference stated; this dimension is not weighted.",
        )

    month = prefs.climate.travel_month
    normals = candidate.features.climate
    temp = None
    if month is not None and normals is not None:
        temp = normals.avg_temp_by_month.get(str(month))

    if temp is None:
        return DimensionScore(
            dimension="climate",
            value=0.5,
            weight=base_weight,
            evidence={"prefer": prefer, "travel_month": month, "avg_temp_c": None},
            explanation=f"No climate normals available for '{candidate.name}' for the travel month; treated as neutral.",
        )

    target = CLIMATE_TARGET_C[prefer]
    diff = abs(temp - target)
    value = _clamp01(1.0 - diff / CLIMATE_TOLERANCE_C)

    return DimensionScore(
        dimension="climate",
        value=value,
        weight=base_weight,
        evidence={"prefer": prefer, "travel_month": month, "avg_temp_c": temp, "target_c": target},
        explanation=(
            f"Average {temp:.0f}°C in month {month}, vs. your '{prefer}' preference "
            f"(target ~{target:.0f}°C)."
        ),
    )


def score_interests(prefs: Preferences, candidate: Candidate, level: Level) -> DimensionScore:
    weight = _base_weight(level, "interests")
    density = candidate.features.interest_density
    counts = candidate.features.interest_counts

    if not prefs.interests:
        return DimensionScore(
            dimension="interests",
            value=0.5,
            weight=weight,
            evidence={"requested": [], "matched": {}},
            explanation="No interests stated; treated as neutral.",
        )

    matched = {tag: density.get(tag, 0.0) for tag in prefs.interests}
    # A geometric mean makes a missing requested interest matter. An option
    # that only matches one of four interests should not score like one that
    # matches all four merely because its arithmetic average is acceptable.
    floor = 0.05
    interest_value = (
        1.0
        if not matched
        else math.prod(max(value, floor) for value in matched.values()) ** (1 / len(matched))
    )

    value = interest_value
    family_note = ""
    family_density = candidate.features.family_poi_density
    if prefs.travellers.children and family_density is not None:
        value = _clamp01(
            (1.0 - FAMILY_FOLD_IN_WEIGHT) * interest_value + FAMILY_FOLD_IN_WEIGHT * family_density
        )
        family_note = f" Family-friendliness (travelling with children) folded in at {family_density:.0%}."

    matched_counts = {tag: counts.get(tag, 0) for tag in prefs.interests}
    return DimensionScore(
        dimension="interests",
        value=value,
        weight=weight,
        evidence={
            "requested": prefs.interests,
            "matched_density": matched,
            "matched_counts": matched_counts,
            "family_poi_density": family_density,
        },
        explanation=(
            f"Matches {', '.join(prefs.interests)} at {interest_value:.0%} average density "
            f"for '{candidate.name}'.{family_note}"
        ),
    )


def score_accessibility(prefs: Preferences, candidate: Candidate, level: Level) -> DimensionScore:
    weight = _base_weight(level, "accessibility")
    need = prefs.accessibility.wheelchair

    if need == "none":
        # same as climate - no preference means this dimension doesn't count
        return DimensionScore(
            dimension="accessibility",
            value=0.5,
            weight=0.0,
            evidence={"wheelchair_need": "none"},
            explanation="No accessibility requirement stated; this dimension is not weighted.",
        )

    state = candidate.features.accessibility
    value = {"supported": 1.0, "unknown": 0.5, "poor": 0.0}[state]

    explanation = {
        "supported": f"'{candidate.name}' has good wheelchair-accessibility tagging coverage.",
        "unknown": (
            f"Accessibility tagging for '{candidate.name}' is too sparse to judge "
            f"({candidate.features.tagged_total} tagged POIs) — treated as neutral, not poor."
        ),
        "poor": f"'{candidate.name}' is tagged as poorly wheelchair-accessible.",
    }[state]

    return DimensionScore(
        dimension="accessibility",
        value=value,
        weight=weight,
        evidence={
            "wheelchair_need": need,
            "accessibility_state": state,
            "accessible_ratio": candidate.features.accessible_ratio,
            "tagged_total": candidate.features.tagged_total,
        },
        explanation=explanation,
    )


def score_safety(prefs: Preferences, candidate: Candidate, level: Level) -> DimensionScore:
    weight = _base_weight(level, "safety")
    safety_index = candidate.features.safety_index

    if safety_index is None:
        # don't have a safety data source hooked up yet, so treat as
        # neutral/unknown rather than assuming it's unsafe
        return DimensionScore(
            dimension="safety",
            value=0.5,
            weight=weight,
            evidence={"safety_index": None},
            explanation=f"No safety data available for '{candidate.name}' yet; treated as neutral.",
        )

    return DimensionScore(
        dimension="safety",
        value=_clamp01(safety_index),
        weight=weight,
        evidence={"safety_index": safety_index},
        explanation=f"Safety index {safety_index:.0%} for '{candidate.name}'.",
    )


SCORERS = (score_budget, score_climate, score_interests, score_accessibility, score_safety)


def score_all_dimensions(
    prefs: Preferences, candidate: Candidate, level: Level
) -> list[DimensionScore]:
    return [scorer(prefs, candidate, level) for scorer in SCORERS]
