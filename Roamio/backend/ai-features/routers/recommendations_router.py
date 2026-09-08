from fastapi import APIRouter, Depends, HTTPException

from config.auth import verify_secretKey
from engine.catalog import load_city_candidates, load_country_catalog
from engine.pipeline import build_response
from schemas.recommendations import RecommendationRequest, RecommendationResponse

router = APIRouter()


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

    try:
        return build_response(request, candidates=candidates)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI_SERVICE_UNAVAILABLE: {e}")
