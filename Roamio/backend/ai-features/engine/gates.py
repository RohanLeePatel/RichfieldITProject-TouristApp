from __future__ import annotations

from engine.currency import convert_from_zar
from engine.dimension import tag_list
from engine.weights import ACCESSIBILITY_HARD_FAIL_STATE, COST_BAND_ZAR_RANGE
from schemas.recommendations import Candidate, Preferences


def check_budget_gate(prefs: Preferences, candidate: Candidate) -> str | None:
    # returns why the candidate got excluded, or None if it's fine
    cost_index = candidate.features.cost_index
    if cost_index is None:
        return None  # no cost data for this one, so don't punish it for that

    lower_bound_zar, _ = COST_BAND_ZAR_RANGE[cost_index]
    lower_bound = convert_from_zar(lower_bound_zar, prefs.currency)
    if lower_bound is None:
        # couldn't convert currency, so we can't actually compare - same idea as above,
        # missing data shouldn't get punished
        return None

    if lower_bound <= prefs.budget_per_day:
        return None

    return (
        f"Estimated daily cost for '{candidate.name}' (band {cost_index}, "
        f"from {lower_bound:.0f} {prefs.currency}) exceeds your budget of "
        f"{prefs.budget_per_day:.0f} {prefs.currency}/day."
    )


def check_accessibility_gate(prefs: Preferences, candidate: Candidate) -> str | None:
    # same deal - reason for exclusion, or None
    if prefs.accessibility.wheelchair != "required":
        return None
    if candidate.features.accessibility != ACCESSIBILITY_HARD_FAIL_STATE:
        return None

    return (
        f"'{candidate.name}' is tagged as poorly wheelchair-accessible "
        f"({candidate.features.accessible_ratio or 0:.0%} of "
        f"{candidate.features.tagged_total} tagged POIs), and wheelchair "
        "access is marked required."
    )


def check_landmark_availability_gate(prefs: Preferences, candidate: Candidate) -> str | None:
    # Without this, a city with literally zero known spots for every requested
    # interest still shows up as a top result, and the user only finds out once
    # they've already committed (trip created) and the landmarks step comes back
    # empty. interest_counts are raw counts from the seed data (not the 0-1
    # normalized density), so a genuine zero here means "we found none", not
    # "this scored low" - a real fact worth excluding on, not just ranking on.
    if not prefs.interests:
        return None
    counts = candidate.features.interest_counts
    # Only gate on tags we actually have a measured count for - a tag key
    # missing entirely means "never measured", not "measured as zero", and
    # shouldn't be punished the same way real seed data always has every tag
    # key present (even if 0) since enrich_destinations.py loops the full map.
    measured = [tag for tag in prefs.interests if tag in counts]
    if not measured:
        return None
    if any(counts[tag] > 0 for tag in measured):
        return None

    return (
        f"No known spots for {tag_list(prefs.interests)} found near '{candidate.name}' in our data."
    )


GATES = (check_budget_gate, check_accessibility_gate, check_landmark_availability_gate)


def run_gates(prefs: Preferences, candidate: Candidate) -> str | None:
    # runs through all the gates, stops at the first one that excludes the candidate
    for gate in GATES:
        reason = gate(prefs, candidate)
        if reason is not None:
            return reason
    return None
