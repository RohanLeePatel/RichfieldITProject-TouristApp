from fastapi import APIRouter, Depends, HTTPException

from config.auth import verify_secretKey
from engine.pipeline import build_response
from schemas.recommendations import RecommendationRequest, RecommendationResponse

router = APIRouter()


@router.post(
    "/recommendations",
    response_model=RecommendationResponse,
    dependencies=[Depends(verify_secretKey)],
)
async def recommendations(request: RecommendationRequest) -> RecommendationResponse:
    try:
        return build_response(request)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI_SERVICE_UNAVAILABLE: {e}")
