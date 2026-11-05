import logging

from fastapi import APIRouter, Depends, HTTPException

from config.auth import verify_secretKey
from engine.catalog import load_city_candidates, load_country_catalog, raw_from_catalog
from engine.currency import rate_unavailable
from engine.pipeline import build_response
from engine.safety import advisory_levels, spans_countries, with_safety
from schemas.recommendations import RecommendationRequest, RecommendationResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/recommendations/catalog",
    dependencies=[Depends(verify_secretKey)],
)
def recommendation_catalog() -> dict:
    countries = load_country_catalog()
    return {
        "countries": [
            {
                "id": country.id,
                "name": country.name,
                "city_count": len(country.children),
            }
            for country in sorted(countries, key=lambda item: item.name.lower())
        ]
    }


@router.post(
    "/recommendations",
    response_model=RecommendationResponse,
    dependencies=[Depends(verify_secretKey)],
)
def recommendations(request: RecommendationRequest) -> RecommendationResponse:
    candidates = request.candidates
    if not candidates:
        managed = raw_from_catalog(request.catalog or [])
        if request.level == "country":
            candidates = load_country_catalog(managed)
        elif request.level == "city":
            candidates = load_city_candidates(country_id=request.parent_id, raw=managed)
            if not candidates:
                raise HTTPException(
                    status_code=404,
                    detail=f"No seeded cities found for country '{request.parent_id}'.",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="No built-in candidate catalog for 'place' level — use /landmarks instead.",
            )

    # keep at least one candidate so a run of dislikes never yields a 500
    kept = [c for c in candidates if c.id not in request.exclude_ids]
    candidates = kept or candidates
    # asked once and shared, so a provider outage costs one wait, not two
    levels = advisory_levels() if spans_countries(candidates) else None
    degraded = []
    if levels is not None and not levels:
        degraded.append("safety")
    if rate_unavailable(request.preferences.currency):
        degraded.append("currency")
    candidates = with_safety(candidates, levels)

    try:
        return build_response(request, candidates=candidates).model_copy(update={"degraded": degraded})
    except Exception:
        # the traceback belongs in the log, not in the response (NFR-22)
        logger.exception("Recommendation pipeline failed for level %s", request.level)
        raise HTTPException(
            status_code=502, detail="Recommendations are unavailable right now. Please try again."
        )
