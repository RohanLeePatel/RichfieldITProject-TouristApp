from fastapi import APIRouter, Depends, HTTPException, Query

from config.auth import verify_secretKey
from landmarks.landmarks import get_landmarks, search_place
from schemas.landmarks import LandmarksResponse, PlaceSearchResponse

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


@router.get("/places/search", response_model=PlaceSearchResponse, dependencies=[Depends(verify_secretKey)])
def place_search(
    text: str = Query(..., min_length=1, max_length=100),
    near: str = Query(..., min_length=1, max_length=100, description="City to search around, e.g. 'Durban, South Africa'."),
    lat: float | None = Query(None, ge=-90, le=90),
    lon: float | None = Query(None, ge=-180, le=180),
    radius_m: int = Query(30000, gt=0, le=50000),
):
    """Is this named place within reach of the trip? Used by the trip assistant when it
    adds a stop (FR-37). found=false is an answer, not an error."""
    result = search_place(text, near, radius_m, lat, lon)
    if result.get("error") and not result["found"]:
        raise HTTPException(status_code=503 if "not configured" in result["error"] else 502, detail=result["error"])
    return result
