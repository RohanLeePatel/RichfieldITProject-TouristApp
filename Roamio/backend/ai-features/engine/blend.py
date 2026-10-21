from __future__ import annotations

from engine.weights import BLEND_CHILDREN_WEIGHT, BLEND_SELF_WEIGHT, BLEND_TOP_N_CHILDREN
from schemas.recommendations import Candidate, Level, Preferences

NEXT_LEVEL: dict[Level, Level] = {"country": "city", "city": "place"}


def blended_score(prefs: Preferences, candidate: Candidate, level: Level, own_score: float) -> tuple[float, dict]:
    # gives back (blended_score, evidence)
    child_level = NEXT_LEVEL.get(level)
    children = candidate.children[:BLEND_TOP_N_CHILDREN]

    if child_level is None or not children:
        return own_score, {"blended": False, "child_count": 0}

    # importing here instead of at the top because pipeline.py imports this file too,
    # so a top-level import would create a circular import
    from engine.pipeline import score_candidate_own

    child_scores = [score_candidate_own(prefs, child, child_level)[0] for child in children]
    mean_child_score = sum(child_scores) / len(child_scores)

    result = BLEND_SELF_WEIGHT * own_score + BLEND_CHILDREN_WEIGHT * mean_child_score
    evidence = {
        "blended": True,
        "child_count": len(children),
        "own_score": own_score,
        "mean_child_score": mean_child_score,
        "self_weight": BLEND_SELF_WEIGHT,
        "children_weight": BLEND_CHILDREN_WEIGHT,
    }
    return result, evidence
