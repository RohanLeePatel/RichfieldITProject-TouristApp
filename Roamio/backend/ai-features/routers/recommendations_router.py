from fastapi import APIRouter, Depends, HTTPException

from config.auth import verify_secretKey
from engine.catalog import load_city_candidates, load_country_catalog
from engine.pipeline import build_response
from schemas.recommendations import RecommendationRequest, RecommendationResponse

router = APIRouter()


@router.get(
    "/recommendations/catalog",
    dependencies=[Depends(verify_secretKey)],
)
async def recommendation_catalog() -> dict:
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
async def recommendations(request: RecommendationRequest) -> RecommendationResponse:
    candidates = request.candidates
    if not candidates:
        if request.level == "country":
            candidates = load_country_catalog()
        elif request.level == "city":
            candidates = load_city_candidates(country_id=request.parent_id)
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

    try:
        return build_response(request, candidates=candidates)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI_SERVICE_UNAVAILABLE: {e}")
