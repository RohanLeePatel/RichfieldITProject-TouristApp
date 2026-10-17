from __future__ import annotations

import math

from engine.currency import convert_from_zar
from engine.dimension import DimensionScore, tag_list
from engine.weights import (
    AVOID_INTEREST_PENALTY,
    CHILD_AGE_BANDS,
    CHILD_INTEREST_WEIGHT_MULTIPLIER,
    CLIMATE_TARGET_C,
    CLIMATE_TOLERANCE_C,
    COST_BAND_ZAR_RANGE,
    FAMILY_FOLD_IN_BASE,
    FAMILY_FOLD_IN_SCALE,
    PACE_STRICTNESS,
    PRIORITY_INTEREST_MIN_DENSITY,
    PRIORITY_INTEREST_UNMET_CEILING,
    PRIORITY_INTEREST_WEIGHT_MULTIPLIER,
    RAIN_COMFORTABLE_MM,
    RAIN_SHARE_OF_CLIMATE,
    RAIN_SOAKED_MM,
    WEIGHTS,
)
from schemas.recommendations import Candidate, Level, Preferences


def _base_weight(level: Level, dimension: str) -> float:
    return WEIGHTS[level].get(dimension, 0.0)


def tags_for_children(ages: list[int]) -> set[str]:
    """Interest tags the children of these ages actually use (CHILD_AGE_BANDS)."""
    tags: set[str] = set()
    for age in ages:
        for upper_bound, band_tags in CHILD_AGE_BANDS:
            if age < upper_bound:
                tags.update(band_tags)
                break
    return tags


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
    month_end = prefs.climate.travel_month_end
    normals = candidate.features.climate

    # Same-year, non-wrapping range only (see schemas/recommendations.py) -
    # a trip crossing a year boundary just falls back to the single start month.
    months_to_average = (
        list(range(month, month_end + 1))
        if month is not None and month_end is not None and month_end >= month
        else [month] if month is not None else []
    )

    temps = (
        [t for m in months_to_average if (t := normals.avg_temp_by_month.get(str(m))) is not None]
        if normals is not None
        else []
    )

    if not temps:
        return DimensionScore(
            dimension="climate",
            value=0.5,
            weight=base_weight,
            evidence={"prefer": prefer, "travel_month": month, "travel_month_end": month_end, "avg_temp_c": None},
            explanation=f"No climate normals available for '{candidate.name}' for the travel period; treated as neutral.",
        )

    avg_temp = sum(temps) / len(temps)
    target = CLIMATE_TARGET_C[prefer]
    diff = abs(avg_temp - target)
    temp_value = _clamp01(1.0 - diff / CLIMATE_TOLERANCE_C)

    # Temperature alone called a warm month in the middle of a monsoon a good
    # month. Rain is folded in only where the seed carries it, so rows written
    # before it was collected keep the temperature-only score rather than
    # being penalised for missing data.
    rains = (
        [r for m in months_to_average if (r := normals.avg_rain_mm_by_month.get(str(m))) is not None]
        if normals is not None
        else []
    )
    value = temp_value
    rain_note = ""
    avg_rain = None
    if rains:
        avg_rain = sum(rains) / len(rains)
        span = RAIN_SOAKED_MM - RAIN_COMFORTABLE_MM
        rain_value = _clamp01(1.0 - (avg_rain - RAIN_COMFORTABLE_MM) / span)
        value = _clamp01(
            (1.0 - RAIN_SHARE_OF_CLIMATE) * temp_value + RAIN_SHARE_OF_CLIMATE * rain_value
        )
        rain_note = f" Typically {avg_rain:.0f}mm of rain then ({rain_value:.0%} on dryness)."

    period_label = (
        f"months {month}-{month_end}" if len(months_to_average) > 1 else f"month {month}"
    )
    return DimensionScore(
        dimension="climate",
        value=value,
        weight=base_weight,
        evidence={
            "prefer": prefer,
            "travel_month": month,
            "travel_month_end": month_end,
            "avg_temp_c": avg_temp,
            "target_c": target,
            "avg_rain_mm": avg_rain,
        },
        explanation=(
            f"Average {avg_temp:.0f}°C across {period_label}, vs. your '{prefer}' preference "
            f"(target ~{target:.0f}°C).{rain_note}"
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

    # Tags the children in the group actually use, by their ages. Only the
    # count of children used to matter, so a toddler and a teenager pulled the
    # score the same way; now a 4-year-old lifts playgrounds and a 15-year-old
    # does not.
    child_tags = tags_for_children(prefs.travellers.children)

    floor = 0.05
    tag_weights = {}
    for tag in matched:
        tag_weight = PRIORITY_INTEREST_WEIGHT_MULTIPLIER if tag in prefs.priority_interests else 1.0
        if tag in child_tags:
            tag_weight *= CHILD_INTEREST_WEIGHT_MULTIPLIER
        tag_weights[tag] = tag_weight
    total_tag_weight = sum(tag_weights.values())

    if not matched:
        interest_value = 1.0
    else:
        # The geometric mean punishes any weak tag; the arithmetic mean
        # tolerates one. Which is right depends on pace: a group doing two
        # things a day only needs one category to be excellent, a group doing
        # five needs the whole spread to hold up. Pace was collected and then
        # never reached scoring at all - this is where it lands.
        geometric = math.exp(
            sum(tag_weights[tag] * math.log(max(value, floor)) for tag, value in matched.items())
            / total_tag_weight
        )
        arithmetic = (
            sum(tag_weights[tag] * value for tag, value in matched.items()) / total_tag_weight
        )
        strictness = PACE_STRICTNESS.get(prefs.pace, PACE_STRICTNESS["balanced"])
        interest_value = strictness * geometric + (1.0 - strictness) * arithmetic

    # A must-have the destination barely has should cap the score outright.
    # Doubling its weight inside a mean let a strong showing elsewhere carry a
    # candidate that misses the one thing the traveller insisted on.
    unmet_priorities = [
        tag
        for tag in prefs.priority_interests
        if tag in matched and matched[tag] < PRIORITY_INTEREST_MIN_DENSITY
    ]
    if unmet_priorities:
        interest_value = min(interest_value, PRIORITY_INTEREST_UNMET_CEILING)

    # Dealbreakers never reached the engine before - the browser stripped them
    # from the request - so a destination whose whole appeal is the thing
    # someone asked to avoid scored exactly like one without it.
    avoided_present = {
        tag: density.get(tag, 0.0)
        for tag in prefs.avoid_interests
        if density.get(tag, 0.0) > 0.0
    }
    if avoided_present:
        worst = max(avoided_present.values())
        interest_value = _clamp01(interest_value * (1.0 - AVOID_INTEREST_PENALTY * worst))

    value = interest_value
    family_note = ""
    family_density = candidate.features.family_poi_density
    if prefs.travellers.children and family_density is not None:
        total_travellers = prefs.travellers.adults + len(prefs.travellers.children)
        child_ratio = len(prefs.travellers.children) / max(1, total_travellers)
        fold_in_weight = FAMILY_FOLD_IN_BASE + FAMILY_FOLD_IN_SCALE * child_ratio
        value = _clamp01(
            (1.0 - fold_in_weight) * interest_value + fold_in_weight * family_density
        )
        family_note = (
            f" Family-friendliness (travelling with children) folded in at "
            f"{family_density:.0%}, weighted {fold_in_weight:.0%} for your group makeup."
        )

    matched_counts = {tag: counts.get(tag, 0) for tag in prefs.interests}
    return DimensionScore(
        dimension="interests",
        value=value,
        weight=weight,
        evidence={
            "requested": prefs.interests,
            "priority": [tag for tag in prefs.interests if tag in prefs.priority_interests],
            "matched_density": matched,
            "matched_counts": matched_counts,
            "family_poi_density": family_density,
        },
        explanation=(
            f"Matches {tag_list(prefs.interests)} at {interest_value:.0%} average density "
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
        # No safety source is wired up yet, so nothing here is measured. Same
        # rule as climate/accessibility above: an unmeasured dimension gets
        # weight 0 rather than a neutral score at full weight.
        #
        # Scoring it 0.5 at the full weight was worse than useless: since no
        # seeded candidate has a safety_index, every one of them collected the
        # identical contribution, which discriminated between nothing and
        # squeezed the dimensions that do discriminate into a smaller share of
        # the total - enough to tie candidates that budget and interests would
        # otherwise have separated.
        return DimensionScore(
            dimension="safety",
            value=0.5,
            weight=0.0,
            evidence={"safety_index": None},
            explanation=f"No safety data available for '{candidate.name}' yet; not counted.",
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
