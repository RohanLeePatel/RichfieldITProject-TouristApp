from __future__ import annotations

from engine.blend import blended_score
from engine.explain import build_comparison, build_explanation
from engine.gates import run_gates
from engine.scorers import score_all_dimensions
from schemas.recommendations import (
    Candidate,
    EvidenceEntry,
    ExcludedCandidate,
    Level,
    Preferences,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationResult,
)


def score_candidate_own(
    prefs: Preferences, candidate: Candidate, level: Level
) -> tuple[float, list[EvidenceEntry]]:

    dims = score_all_dimensions(prefs, candidate, level)
    total_weight = sum(d.weight for d in dims)

    if total_weight <= 0:
        # can happen if every dimension got zeroed out at this level (no interests picked,
        # no accessibility need, etc) - just give a neutral score instead of dividing by zero
        breakdown = [
            EvidenceEntry(dimension=d.dimension, value=d.value, weight=0.0, evidence=d.evidence, explanation=d.explanation)
            for d in dims
        ]
        return 0.5, breakdown

    breakdown = [
        EvidenceEntry(
            dimension=d.dimension,
            value=d.value,
            weight=d.weight / total_weight,
            evidence=d.evidence,
            explanation=d.explanation,
        )
        for d in dims
    ]
    own_score = sum(e.value * e.weight for e in breakdown)
    return own_score, breakdown


def score_candidates(
    prefs: Preferences, level: Level, candidates: list[Candidate]
) -> tuple[list[RecommendationResult], list[ExcludedCandidate], str | None]:
    excluded: list[ExcludedCandidate] = []
    scored: list[tuple[Candidate, float, list[EvidenceEntry]]] = []

    for candidate in candidates:
        reason = run_gates(prefs, candidate)
        if reason is not None:
            excluded.append(ExcludedCandidate(id=candidate.id, reason=reason))
            continue

        own_score, breakdown = score_candidate_own(prefs, candidate, level)
        final_score, blend_evidence = blended_score(prefs, candidate, level, own_score)
        final_score = max(0.0, min(1.0, final_score))

        # add the blend result as its own entry in the breakdown so it's visible in the
        # response - weight 0 since it's not an actual scoring dimension, just showing our work
        breakdown = [
            *breakdown,
            EvidenceEntry(
                dimension="bottom_up_blend",
                value=final_score,
                weight=0.0,
                evidence=blend_evidence,
                explanation=(
                    f"Blended with {blend_evidence['child_count']} child candidate(s)."
                    if blend_evidence["blended"]
                    else "No child candidates provided; own-score used as-is."
                ),
            ),
        ]
        scored.append((candidate, final_score, breakdown))

    scored.sort(key=lambda t: t[1], reverse=True)

    results = [
        RecommendationResult(
            id=candidate.id,
            rank=rank,
            total_score=round(score, 4),
            breakdown=breakdown,
            explanation=build_explanation(candidate.name, breakdown),
        )
        for rank, (candidate, score, breakdown) in enumerate(scored, start=1)
    ]

    comparison = None
    if len(scored) >= 2:
        (c1, _, b1), (c2, _, b2) = scored[0], scored[1]
        comparison = build_comparison(c1.name, b1, c2.name, b2)

    return results, excluded, comparison


def build_response(
    request: RecommendationRequest, candidates: list[Candidate] | None = None
) -> RecommendationResponse:
    candidates = candidates if candidates is not None else request.candidates
    results, excluded, comparison = score_candidates(request.preferences, request.level, candidates)
    return RecommendationResponse(
        request_id=request.request_id,
        session_id=request.session_id,
        level=request.level,
        results=results,
        excluded=excluded,
        comparison=comparison,
    )
