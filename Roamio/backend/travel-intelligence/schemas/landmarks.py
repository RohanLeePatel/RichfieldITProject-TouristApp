from typing import Optional

from pydantic import BaseModel


class Landmark(BaseModel):
    name: str
    category: Optional[str] = None
    lat: float
    lon: float
    address: Optional[str] = None
    distance_m: float
    # raw OSM opening_hours syntax (e.g. "Mo-Fr 08:00-18:00; Sa 09:00-13:00"),
    # passed through as-is - not parsed. Fully parsing that mini-language is a
    # bigger job than surfacing it; the frontend does a best-effort check only
    # for the simple single-daily-range case, see itineraryPlanner.js.
    opening_hours: Optional[str] = None


class LandmarkGroup(BaseModel):
    interest: str
    explanation: str
    landmarks: list[Landmark] = []


class LandmarksResponse(BaseModel):
    destination: Optional[str] = None
    groups: list[LandmarkGroup] = []
    error: Optional[str] = None


class PlaceSearchResponse(BaseModel):
    found: bool
    name: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    distance_m: Optional[float] = None
    error: Optional[str] = None
