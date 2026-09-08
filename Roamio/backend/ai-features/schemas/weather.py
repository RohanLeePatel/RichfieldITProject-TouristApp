from typing import Optional

from pydantic import BaseModel


class CurrentConditions(BaseModel):
    description: Optional[str] = None
    temp: Optional[float] = None
    feels_like: Optional[float] = None
    humidity: Optional[int] = None
    wind_speed: Optional[float] = None


class ForecastDay(BaseModel):
    date: str
    description: Optional[str] = None
    temp: Optional[float] = None
    humidity: Optional[int] = None


class WeatherResponse(BaseModel):
    city: Optional[str] = None
    units: Optional[str] = None
    current: Optional[CurrentConditions] = None
    forecast: list[ForecastDay] = []
    error: Optional[str] = None
