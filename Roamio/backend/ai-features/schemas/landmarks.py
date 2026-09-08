from typing import Optional

from pydantic import BaseModel


class Landmark(BaseModel):
    name: str
    category: Optional[str] = None
    lat: float
    lon: float
    address: Optional[str] = None
    distance_m: float


class LandmarkGroup(BaseModel):
    interest: str
    explanation: str
    landmarks: list[Landmark] = []


class LandmarksResponse(BaseModel):
    destination: Optional[str] = None
    groups: list[LandmarkGroup] = []
    error: Optional[str] = None
