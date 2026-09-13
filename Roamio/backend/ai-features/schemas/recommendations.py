from __future__ import annotations

from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

Level = Literal["country", "city", "place"]
WheelchairNeed = Literal["required", "preferred", "none"]
ClimatePreference = Literal["mild", "hot", "cold"]
Pace = Literal["packed", "balanced", "relaxed"]
AccessibilityState = Literal["supported", "unknown", "poor"]


# ---------------------------------------------------------------------------
# Request
# ---------------------------------------------------------------------------


class Travellers(BaseModel):
    adults: int = Field(ge=1)
    children: list[int] = Field(default_factory=list, description="Ages of travelling children.")


class Accessibility(BaseModel):
    wheelchair: WheelchairNeed = "none"


class ClimatePrefs(BaseModel):
    prefer: Optional[ClimatePreference] = None
    travel_month: Optional[int] = Field(default=None, ge=1, le=12)


class Preferences(BaseModel):
    budget_per_day: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, description="ISO 4217, e.g. ZAR.")
    interests: list[str] = Field(default_factory=list)
    travellers: Travellers
    accessibility: Accessibility = Field(default_factory=Accessibility)
    climate: ClimatePrefs = Field(default_factory=ClimatePrefs)
    pace: Pace = "balanced"


class ClimateNormals(BaseModel):
    """
    Monthly average temp in °C, keyed '1'..'12'. Comes from Open-Meteo for
    the offline seed data - not the same as the live OpenWeather forecast
    the app shows elsewhere (see enrich_destinations.py for why we use two
    different weather APIs here).
    """

    avg_temp_by_month: dict[str, float] = Field(default_factory=dict)


class CandidateFeatures(BaseModel):
    """
    Everything we know about a candidate place, aggregated. We never see raw
    POI-level data here, just the rolled-up numbers.
    """

    # counts are raw numbers (useful for the explanation text), density is the
    # normalised 0-1 version the scorer actually uses
    interest_counts: dict[str, int] = Field(default_factory=dict)
    interest_density: dict[str, float] = Field(default_factory=dict)

    # gets folded into the interests score in scorers.py instead of being its
    # own weighted dimension - there's no separate "family" weight, and family
    # POI categories (zoo/aquarium/theme_park) are already covered as interest tags
    family_poi_density: Optional[float] = Field(default=None, ge=0, le=1)

    # three states here on purpose - barely-tagged places need to read as
    # "unknown", not "poor"
    accessibility: AccessibilityState = "unknown"
    accessible_ratio: Optional[float] = Field(default=None, ge=0, le=1)
    tagged_total: int = 0

    # 1 = cheapest, 5 = most expensive, hand-curated (see cities_seed.py)
    cost_index: Optional[int] = Field(default=None, ge=1, le=5)

    climate: Optional[ClimateNormals] = None

    # None means we don't have data, not that it's unsafe - scored neutral,
    # same as accessibility
    safety_index: Optional[float] = Field(default=None, ge=0, le=1)


class Candidate(BaseModel):
    id: str
    name: str
    country: Optional[str] = None
    image_url: Optional[str] = None
    features: CandidateFeatures
    # small set of representative children (e.g. a country's top few cities),
    # only used for the bottom-up blend
    children: list["Candidate"] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    request_id: UUID
    session_id: UUID
    level: Level
    parent_id: Optional[str] = None
    preferences: Preferences
    # optional - leave this out and the service will just use its built-in
    # catalog (engine/catalog.py) based on level/preferences. pass it in if you
    # want to score your own specific set of candidates instead
    candidates: Optional[list[Candidate]] = None

    @model_validator(mode="after")
    def _candidates_not_explicitly_empty(self) -> "RecommendationRequest":
        if self.candidates is not None and not self.candidates:
            raise ValueError("candidates must not be empty when provided")
        return self


# ---------------------------------------------------------------------------
# Response
# ---------------------------------------------------------------------------


class EvidenceEntry(BaseModel):
    """one scoring dimension's contribution to the total, plus why it got that score"""

    dimension: str
    value: float = Field(ge=0, le=1)
    weight: float = Field(ge=0, le=1)
    evidence: dict = Field(default_factory=dict)
    explanation: str


class RecommendationResult(BaseModel):
    id: str
    name: str
    country: Optional[str] = None
    image_url: Optional[str] = None
    map_url: str
    rank: int
    total_score: float = Field(ge=0, le=1)
    breakdown: list[EvidenceEntry]
    explanation: str


class ExcludedCandidate(BaseModel):
    id: str
    name: str
    country: Optional[str] = None
    reason: str


class RecommendationResponse(BaseModel):
    request_id: UUID
    session_id: UUID
    level: Level
    results: list[RecommendationResult]
    excluded: list[ExcludedCandidate] = Field(default_factory=list)
    # one-line "why #1 beat #2" comparison, based on whichever dimension had the
    # biggest gap between them. null if fewer than 2 results made it through gating
    comparison: Optional[str] = None
