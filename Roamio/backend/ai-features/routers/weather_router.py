from fastapi import APIRouter, Depends, HTTPException, Path, Query

from config.auth import verify_secretKey
from schemas.weather import WeatherResponse
from weather.weather import get_weather

router = APIRouter()


# Reached through the Core API's /api/weather proxy, not from the browser: the
# OpenWeather key lives here and the route costs shared provider quota (NFR-11).
@router.get("/weather/{city}", response_model=WeatherResponse, dependencies=[Depends(verify_secretKey)])
def weather(
    city: str = Path(min_length=1, max_length=100),
    units: str = Query("metric", pattern="^(metric|imperial)$"),
):
    result = get_weather(city, units)
    # The weather module returns plain-text errors, not codes, so the status is picked
    # from the wording. If those messages change, update these checks too. A stale
    # result is still returned, because it has `current` data and is not an error.
    error = result.get("error")
    if error and not result.get("current"):
        if "not configured" in error:
            raise HTTPException(status_code=503, detail=error)
        if "No weather data found" in error:
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=502, detail=error)
    return result
