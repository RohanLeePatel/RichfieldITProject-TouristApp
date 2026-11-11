from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from schemas.recommendations import AccessibilityState


class EnrichRequest(BaseModel):
    """Where a destination is. The Core API sends the admin's own entry."""

    name: str = Field(min_length=1, max_length=120)
    country: str = Field(min_length=1, max_length=120)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=12000, ge=1000, le=30000)


class GeocodeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    country: str = Field(min_length=1, max_length=120)


class GeocodeResponse(BaseModel):
    lat: float
    lon: float


class EnrichResponse(BaseModel):
    interest_counts: dict[str, int]
    accessibility: AccessibilityState
    accessible_ratio: Optional[float] = None
    tagged_total: int
    avg_temp_by_month: dict[str, float]
    avg_rain_mm_by_month: dict[str, float]
    image_url: Optional[str] = None
