"""
Folds several travellers' preferences into the single Preferences object the
scoring pipeline takes.

Everything else in the engine assumes one preference set. Rather than teach
every scorer about groups, the merge happens once, up front, and the pipeline
never knows the difference. The rules below are deliberately asymmetric: a
constraint that would exclude someone wins, a taste that would merely
disappoint someone gets averaged. Shared-wallet logic, not fairness-by-mean.

The merge also returns notes explaining which rule decided each field, so the
response can show its reasoning the same way the scorers do.
"""

from __future__ import annotations

from collections import Counter

from engine.weights import GROUP_MISERY_WEIGHT
from schemas.recommendations import (
    Accessibility,
    ClimatePrefs,
    Pace,
    Preferences,
    WheelchairNeed,
)

# strictest need wins - a group travelling with someone who needs a ramp needs
# a ramp, no matter how the vote goes
WHEELCHAIR_STRICTNESS: dict[WheelchairNeed, int] = {"none": 0, "preferred": 1, "required": 2}

# the middle option, used when a pace vote ties
DEFAULT_PACE: Pace = "balanced"


def _union(lists: list[list[str]]) -> list[str]:
    """Flatten preserving first-seen order, no duplicates."""
    seen: dict[str, None] = {}
    for values in lists:
        for value in values:
            seen.setdefault(value.strip().lower(), None)
    return [value for value in seen if value]


def _majority(values: list[str], tie_breaker: str | None) -> str | None:
    """Most common value, or tie_breaker when nothing has a clear plurality."""
    present = [value for value in values if value]
    if not present:
        return tie_breaker
    counts = Counter(present).most_common()
    if len(counts) > 1 and counts[0][1] == counts[1][1]:
        return tie_breaker
    return counts[0][0]


def _without_avoided(preferences: Preferences, avoided: list[str]) -> Preferences:
    """
    Apply the group's avoid list to the merged preferences.

    Two reasons this has to happen here rather than in the browser. The merge
    used to build its Preferences field by field and simply never mentioned
    avoid_interests, so the field defaulted back to empty and the penalty in
    score_interests could never fire however the request was filled in. And
    detect_conflicts tells the group a must-have "has been excluded", which was
    only true if something actually excluded it.
    """
    blocked = set(avoided)
    return preferences.model_copy(
        update={
            "avoid_interests": avoided,
            "interests": [tag for tag in preferences.interests if tag not in blocked],
            "priority_interests": [
                tag for tag in preferences.priority_interests if tag not in blocked
            ],
        }
    )


def merge_preferences(members: list[Preferences]) -> tuple[Preferences, dict]:
    """
    Combine one or more travellers' preferences. members[0] is the organiser.

    Trip-level facts belong to the organiser and are not voted on: currency,
    travel dates, and the traveller count. `member_preferences` describe people
    who are *already counted* in the organiser's `travellers` - they are
    preference profiles within the group, not extra heads - so adding one never
    changes the party size.

    Returns (merged_preferences, notes).
    """
    if not members:
        raise ValueError("merge_preferences needs at least one member")

    organiser = members[0]
    if len(members) == 1:
        return _without_avoided(organiser, organiser.avoid_interests), {
            "merged": False,
            "member_count": 1,
        }

    # Shared wallet: the group can only spend what its tightest budget allows.
    # Averaging would hand everyone a daily figure the cheapest traveller
    # cannot actually afford.
    budget = min(member.budget_per_day for member in members)

    avoided = _union([member.avoid_interests for member in members])
    interests = _union([member.interests for member in members])
    # one person's must-have is the group's must-have - if it were averaged
    # away, the engine would rank destinations that miss it just as highly
    priority = _union([member.priority_interests for member in members])

    wheelchair = max(
        (member.accessibility.wheelchair for member in members),
        key=lambda need: WHEELCHAIR_STRICTNESS[need],
    )

    climate = _majority([member.climate.prefer or "" for member in members], tie_breaker=None)
    pace = _majority([member.pace for member in members], tie_breaker=DEFAULT_PACE)

    merged = Preferences(
        budget_per_day=budget,
        currency=organiser.currency,
        interests=interests,
        priority_interests=priority,
        # not summed - see the docstring: members are profiles within the
        # organiser's party, so summing would double-count the same people
        travellers=organiser.travellers,
        accessibility=Accessibility(wheelchair=wheelchair),
        # dates belong to the trip, not to a traveller - take the organiser's,
        # falling back to the first member who supplied one
        climate=ClimatePrefs(
            prefer=climate,  # type: ignore[arg-type]  # one of mild/hot/cold or None by construction above
            travel_month=next(
                (m.climate.travel_month for m in members if m.climate.travel_month is not None), None
            ),
            travel_month_end=next(
                (m.climate.travel_month_end for m in members if m.climate.travel_month_end is not None), None
            ),
        ),
        pace=pace,  # type: ignore[arg-type]  # a valid Pace by construction above
    )

    merged = _without_avoided(merged, avoided)

    notes = {
        "merged": True,
        "member_count": len(members),
        "budget_per_day": {
            "rule": "lowest",
            "chosen": budget,
            "submitted": [member.budget_per_day for member in members],
        },
        "interests": {"rule": "union", "chosen": merged.interests},
        "priority_interests": {"rule": "union", "chosen": merged.priority_interests},
        "avoid_interests": {"rule": "union", "chosen": avoided},
        "accessibility": {
            "rule": "strictest",
            "chosen": wheelchair,
            "submitted": [member.accessibility.wheelchair for member in members],
        },
        "climate": {
            "rule": "majority",
            "chosen": climate,
            "submitted": [member.climate.prefer for member in members],
        },
        "pace": {"rule": "majority", "chosen": pace, "submitted": [member.pace for member in members]},
        "travellers": {
            "rule": "organiser",
            "adults": merged.travellers.adults,
            "children": len(merged.travellers.children),
        },
    }
    return merged, notes


def explain_merge(notes: dict) -> str | None:
    """One readable line summarising the merge, for the response."""
    if not notes.get("merged"):
        return None

    parts = [f"Combined {notes['member_count']} travellers' preferences"]
    budget = notes["budget_per_day"]
    if len(set(budget["submitted"])) > 1:
        parts.append(f"used the lowest daily budget ({budget['chosen']:.0f})")
    if notes["accessibility"]["chosen"] != "none":
        parts.append(f"kept the strictest access need ({notes['accessibility']['chosen']})")
    if notes["interests"]["chosen"]:
        parts.append(f"pooled {len(notes['interests']['chosen'])} interests")
    if notes["climate"]["chosen"] is None and any(notes["climate"]["submitted"]):
        parts.append("no climate preference won a majority")
    return ": ".join([parts[0], ", ".join(parts[1:])]) + "." if len(parts) > 1 else parts[0] + "."


# ---------------------------------------------------------------------------
# Scoring a group without flattening it first
# ---------------------------------------------------------------------------
#
# merge_preferences above answers "what does this group jointly want", which
# the gates need. It cannot answer "does this destination work for everyone",
# because the union of interests hides whose interest was matched: a city with
# superb museums and nothing else scores well for a party of four as long as
# one of them said museums. Nobody's dissatisfaction is represented anywhere.
#
# So candidates are also scored against each member on their own, and those
# scores are combined with a rule that lets one unhappy member cost a
# candidate the top slot. Standard group-recommender practice: an average
# damped toward the least happy member, rather than a plain mean (which
# ignores misery) or a pure minimum (which lets one veto decide everything).


def aggregate_scores(member_scores: list[float]) -> float:
    """
    Combine one candidate's per-member scores into the group's score:
    (1 - w) * mean + w * min, with w = GROUP_MISERY_WEIGHT.
    """
    if not member_scores:
        raise ValueError("aggregate_scores needs at least one member score")
    mean = sum(member_scores) / len(member_scores)
    worst = min(member_scores)
    return (1.0 - GROUP_MISERY_WEIGHT) * mean + GROUP_MISERY_WEIGHT * worst


def member_label(preferences: Preferences, index: int) -> str:
    """What to call this traveller in an explanation."""
    label = (preferences.label or "").strip()
    return label or ("You" if index == 0 else f"Traveller {index + 1}")


def detect_conflicts(members: list[Preferences]) -> list[str]:
    """
    Disagreements worth telling the group about rather than resolving in
    silence. A dealbreaker quietly beating someone else's must-have is the
    kind of thing that makes a recommendation look broken to the person who
    asked for it.
    """
    if len(members) < 2:
        return []

    conflicts: list[str] = []
    labelled = [(member_label(m, i), m) for i, m in enumerate(members)]

    for label, member in labelled:
        for tag in member.priority_interests:
            objectors = [
                other_label
                for other_label, other in labelled
                if other is not member and tag in other.avoid_interests
            ]
            if objectors:
                conflicts.append(
                    f"{label} marked '{tag}' a must-have, but "
                    f"{' and '.join(objectors)} asked to avoid it - it has been excluded."
                )

    budgets = [(label, m.budget_per_day) for label, m in labelled]
    lowest_label, lowest = min(budgets, key=lambda pair: pair[1])
    highest = max(budget for _, budget in budgets)
    if highest > 0 and lowest < highest / 2:
        conflicts.append(
            f"Daily budgets differ widely ({lowest:.0f} to {highest:.0f}); "
            f"{lowest_label}'s limit sets the group's."
        )

    return conflicts
