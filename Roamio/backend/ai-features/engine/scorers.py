from __future__ import annotations

from engine.currency import convert_from_zar
from engine.dimension import DimensionScore
from engine.weights import (
    CLIMATE_TARGET_C,
    CLIMATE_TOLERANCE_C,
    COST_BAND_ZAR_RANGE,
    WEIGHTS,
)
from schemas.recommendations import Candidate, Level, Preferences

# Weight given to family_poi_density inside the interests blend, when children
# are travelling and the candidate has family POI data. Chosen so a strong
# interest match isn't drowned out by one extra signal, but families with
# young kids still feel it in the ranking.
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
    # Band 5 is open-ended; use its floor as the representative cost rather
    # than an infinite midpoint. Otherwise use the band midpoint.
    representative_zar = (
        lower_bound_zar if upper_bound_zar == float("inf") else (lower_bound_zar + upper_bound_zar) / 2
    )
    representative = convert_from_zar(representative_zar, prefs.currency)

    if representative is None:
        # Rate unavailable (no API key / lookup failed) — same "treated as
        # neutral" discipline as the cost_index is None case above, not a
        # reason to crash or silently compare mismatched currencies.
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

    # Cheaper relative to the user's budget scores higher. Gate already
    # removed anything whose band floor is unaffordable, so this only ranks
    # among survivors.
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
        # "No preference" zeroes the weight — §5. It's not the same as
        # defaulting to a middle score; this dimension simply doesn't count.
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
    interest_value = sum(matched.values()) / len(matched) if matched else 0.0

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
        # "No preference" zeroes the weight — §5, same rule as climate.
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
        # No safety data source is wired up yet (see schemas module
        # docstring, note 1) — read as unknown/neutral, never as unsafe.
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
