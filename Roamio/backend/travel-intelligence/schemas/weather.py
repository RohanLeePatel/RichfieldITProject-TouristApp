from typing import Optional

from pydantic import BaseModel


class CurrentConditions(BaseModel):
    description: Optional[str] = None
    temp: Optional[float] = None
    feels_like: Optional[float] = None
    humidity: Optional[int] = None
    wind_speed: Optional[float] = None
    precipitation_mm: Optional[float] = None


class ForecastDay(BaseModel):
    date: str
    description: Optional[str] = None
    temp: Optional[float] = None
    humidity: Optional[int] = None
    wind_speed: Optional[float] = None
    precipitation_chance: Optional[int] = None  # percent
    precipitation_mm: Optional[float] = None


class WeatherResponse(BaseModel):
    city: Optional[str] = None
    units: Optional[str] = None
    # when the provider was last called, and whether this answer came from an
    # expired cache entry because the provider is currently failing (NFR-13)
    fetched_at: Optional[str] = None
    stale: bool = False
    current: Optional[CurrentConditions] = None
    forecast: list[ForecastDay] = []
    error: Optional[str] = None
