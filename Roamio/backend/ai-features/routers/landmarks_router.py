from fastapi import APIRouter, Depends, HTTPException, Query

from config.auth import verify_secretKey
from landmarks.landmarks import get_landmarks
from schemas.landmarks import LandmarksResponse

router = APIRouter()


@router.get("/landmarks", response_model=LandmarksResponse, dependencies=[Depends(verify_secretKey)])
def landmarks(
    destination: str = Query(..., min_length=1, max_length=100),
    interests: str = Query(..., max_length=200, description="Comma-separated interest tags, e.g. 'history,food'."),
    radius_m: int = Query(5000, gt=0, le=50000),
):
    interest_list = [i.strip() for i in interests.split(",") if i.strip()]
    if not interest_list:
        raise HTTPException(status_code=422, detail="`interests` must contain at least one tag.")

    result = get_landmarks(destination, interest_list, radius_m)
    error = result.get("error")
    if error and not result.get("groups"):
        if "not configured" in error:
            raise HTTPException(status_code=503, detail=error)
        if "Could not locate" in error:
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=502, detail=error)
    return result
