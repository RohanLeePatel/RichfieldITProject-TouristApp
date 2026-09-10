from fastapi import APIRouter, HTTPException, Query

from schemas.weather import WeatherResponse
from weather.weather import get_weather

router = APIRouter()


@router.get("/weather/{city}", response_model=WeatherResponse)
async def weather(city: str, units: str = Query("metric", pattern="^(metric|imperial)$")):
    result = get_weather(city, units)
    error = result.get("error")
    if error and not result.get("current"):
        if "not configured" in error:
            raise HTTPException(status_code=503, detail=error)
        if "No weather data found" in error:
            raise HTTPException(status_code=404, detail=error)
        raise HTTPException(status_code=502, detail=error)
    return result
