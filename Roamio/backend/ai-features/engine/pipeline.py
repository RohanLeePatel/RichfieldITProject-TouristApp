from __future__ import annotations

from urllib.parse import quote_plus

from engine.blend import blended_score
from engine.explain import build_comparison, build_explanation
from engine.gates import run_gates
from engine.scorers import score_all_dimensions
from engine.weights import BASE_RELEVANCE_FLOOR, MAX_RESULTS
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
            excluded.append(
                ExcludedCandidate(id=candidate.id, name=candidate.name, country=candidate.country, reason=reason)
            )
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

    # Relative to the *actual* top score for this request, not a fixed absolute
    # number - a fixed floor could exclude every candidate when a niche request
    # (e.g. a single rare interest tag) just legitimately scores low everywhere,
    # coming back with zero results even though some candidates are clearly the
    # best of what's available. Multiplying by top_score guarantees the top
    # candidate always clears its own floor, so a request with any scored
    # candidates never comes back empty from this step.
    requested_count = len(prefs.interests)
    top_score = scored[0][1] if scored else 0.0
    relevance_floor = min(
        0.55,
        top_score
        * (
            BASE_RELEVANCE_FLOOR
            + min(requested_count, 3) * 0.02
            + (0.02 if prefs.climate.prefer else 0.0)
            + (0.02 if prefs.accessibility.wheelchair != "none" else 0.0)
        ),
    )

    strong_matches: list[tuple[Candidate, float, list[EvidenceEntry]]] = []
    for candidate, score, breakdown in scored:
        if len(scored) > MAX_RESULTS[level] and score < relevance_floor:
            excluded.append(
                ExcludedCandidate(
                    id=candidate.id,
                    name=candidate.name,
                    country=candidate.country,
                    reason=(
                        f"Overall relevance score {score:.0%} was below the "
                        f"{relevance_floor:.0%} match threshold for these preferences."
                    ),
                )
            )
        else:
            strong_matches.append((candidate, score, breakdown))

    # Keep the strongest results, while avoiding a page made up of one repeated
    # interest when the candidate set offers other well-scoring categories.
    selected: list[tuple[Candidate, float, list[EvidenceEntry]]] = []
    remaining = list(strong_matches)
    max_results = MAX_RESULTS[level]
    while remaining and len(selected) < max_results:
        next_index = 0
        if prefs.interests:
            selected_tags = [
                max(
                    prefs.interests,
                    key=lambda tag: item[0].features.interest_density.get(tag, 0.0),
                )
                for item in selected
            ]
            for index, item in enumerate(remaining):
                dominant = max(
                    prefs.interests,
                    key=lambda tag: item[0].features.interest_density.get(tag, 0.0),
                )
                if selected_tags.count(dominant) < 2:
                    next_index = index
                    break
        selected.append(remaining.pop(next_index))

    for candidate, score, breakdown in remaining:
        excluded.append(
            ExcludedCandidate(
                id=candidate.id,
                name=candidate.name,
                country=candidate.country,
                reason=f"Ranked below the top {max_results} relevant matches.",
            )
        )

    results = [
        RecommendationResult(
            id=candidate.id,
            name=candidate.name,
            country=candidate.country if candidate.country else (candidate.name if level == "country" else None),
            image_url=candidate.image_url,
            map_url=f"https://www.google.com/maps/search/?api=1&query={quote_plus(candidate.name)}",
            rank=rank,
            total_score=round(score, 4),
            breakdown=breakdown,
            explanation=build_explanation(candidate.name, breakdown),
        )
        for rank, (candidate, score, breakdown) in enumerate(selected, start=1)
    ]

    comparison = None
    if len(selected) >= 2:
        (c1, _, b1), (c2, _, b2) = selected[0], selected[1]
        comparison = build_comparison(c1.name, b1, c2.name, b2)

    return results, excluded, comparison


# TODO(db): no feedback loop yet - the engine never learns from what a user
# actually did with a response (which result they picked, which they backed
# out of via "not this city", which landmarks they kept vs unchecked). That's
# a real personalization lever, but needs somewhere durable to record it
# per-user and feed it back into future requests - no bypass makes sense here
# without persistence (a session-only log wouldn't outlive the request that
# produced it), so this is left as a pointer rather than fake infrastructure.
# Once user accounts + a per-user event log exist, the natural hook is here:
# build_response() is the single choke point every recommendation passes through.
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
