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
    Monthly average temperature in °C, keyed '1'..'12'. From Open-Meteo (§2)
    — historical normals for offline enrichment, not the app's live
    OpenWeather forecast (see scripts/enrich_destinations.py docstring for
    why these are two separate APIs, not a mismatch).
    """

    avg_temp_by_month: dict[str, float] = Field(default_factory=dict)


class CandidateFeatures(BaseModel):
    """
    The feature aggregate Node computes per candidate (§1). Raw POI rows never
    cross this boundary — only aggregates.
    """

    # Interest match evidence. Counts are raw (for explanations); density is
    # the normalised (§2) 0-1 signal the scorer actually uses.
    interest_counts: dict[str, int] = Field(default_factory=dict)
    interest_density: dict[str, float] = Field(default_factory=dict)

    # Family-friendliness. Folded into the interests dimension (see
    # engine/scorers.py score_interests) rather than given its own weight,
    # because no WEIGHTS vector in §3 has a "family" key — only "interests"
    # covers it, and family-oriented POI categories (zoo/aquarium/theme_park)
    # are themselves one of the §2 interest tags.
    family_poi_density: Optional[float] = Field(default=None, ge=0, le=1)

    # Three-state accessibility model (§3) — sparse OSM tagging must read as
    # "unknown", never as "poor".
    accessibility: AccessibilityState = "unknown"
    accessible_ratio: Optional[float] = Field(default=None, ge=0, le=1)
    tagged_total: int = 0

    # Manually curated 1 (cheapest) .. 5 (most expensive) band (§2).
    cost_index: Optional[int] = Field(default=None, ge=1, le=5)

    climate: Optional[ClimateNormals] = None

    # See module docstring note (2). None = unknown, not "unsafe" — scored
    # as neutral, same discipline as accessibility.
    safety_index: Optional[float] = Field(default=None, ge=0, le=1)


class Candidate(BaseModel):
    id: str
    name: str
    features: CandidateFeatures
    # See module docstring note (1). Small, representative child set (e.g.
    # a country's top 3 cities) used only for the bottom-up blend.
    children: list["Candidate"] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    request_id: UUID
    session_id: UUID
    level: Level
    parent_id: Optional[str] = None
    preferences: Preferences
    # Optional: omit to have the service pick candidates from its own
    # built-in catalog (engine/catalog.py) based on `level`/`preferences`
    # alone. Pass explicitly to score a caller-supplied candidate set instead.
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
    """One dimension's contribution to a candidate's score, evidence-first (§3)."""

    dimension: str
    value: float = Field(ge=0, le=1)
    weight: float = Field(ge=0, le=1)
    evidence: dict = Field(default_factory=dict)
    explanation: str


class RecommendationResult(BaseModel):
    id: str
    rank: int
    total_score: float = Field(ge=0, le=1)
    breakdown: list[EvidenceEntry]
    explanation: str


class ExcludedCandidate(BaseModel):
    id: str
    reason: str


class RecommendationResponse(BaseModel):
    request_id: UUID
    session_id: UUID
    level: Level
    results: list[RecommendationResult]
    excluded: list[ExcludedCandidate] = Field(default_factory=list)
    # §3: one comparative "why not" line, largest single-dimension delta
    # between rank 1 and rank 2. None when fewer than 2 results survive gating.
    comparison: Optional[str] = None


class RecommendationError(BaseModel):
    """Typed error shape (§1) so Node can map to AI_SERVICE_UNAVAILABLE (§7)."""

    error_code: str
    detail: str
