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
    # optional - when a trip spans multiple months, average the climate score
    # across the inclusive travel_month..travel_month_end range instead of
    # only looking at the start month. Only supports same-year, non-wrapping
    # ranges (travel_month_end >= travel_month) - a trip crossing a year
    # boundary (e.g. Nov -> Jan) just falls back to travel_month alone, see
    # engine/scorers.py score_climate.
    travel_month_end: Optional[int] = Field(default=None, ge=1, le=12)


MIN_INTERESTS = 3  # the wizard (Recommendations.jsx) enforces the same minimum


class Preferences(BaseModel):
    budget_per_day: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, description="ISO 4217, e.g. ZAR.")
    # Who this is, for group explanations ("too pricey for Ayanda"). Optional:
    # a solo request has nobody to name.
    label: Optional[str] = Field(default=None, max_length=60)
    interests: list[str] = Field(default_factory=list)
    # subset of `interests` the user flagged as must-have rather than nice-to-have;
    # not enforced to be a subset, just given extra weight where it overlaps
    priority_interests: list[str] = Field(default_factory=list)
    # tags this traveller wants kept out. Until now dealbreakers were applied
    # in the browser and stripped before the request, so the engine never knew
    # about them and could not report that one member's must-have is another's
    # dealbreaker.
    avoid_interests: list[str] = Field(default_factory=list)
    travellers: Travellers
    accessibility: Accessibility = Field(default_factory=Accessibility)
    climate: ClimatePrefs = Field(default_factory=ClimatePrefs)
    pace: Pace = "balanced"


class ClimateNormals(BaseModel):
    """
    Monthly averages keyed '1'..'12'. Comes from Open-Meteo for the offline
    seed data - not the same as the live OpenWeather forecast the app shows
    elsewhere (see enrich_destinations.py for why we use two different weather
    APIs here).
    """

    avg_temp_by_month: dict[str, float] = Field(default_factory=dict)
    # Total rainfall for the month, in mm. Empty for seed rows written before
    # rainfall was collected; scored only where present, like safety_index.
    avg_rain_mm_by_month: dict[str, float] = Field(default_factory=dict)


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
    # Other travellers on the same trip - preference profiles for people
    # already counted in `preferences.travellers`, not extra heads. The
    # organiser's own preferences stay in `preferences`; these get folded in by
    # engine/group.py before scoring, so the pipeline itself still only ever
    # sees one preference set.
    member_preferences: list[Preferences] = Field(default_factory=list, max_length=10)
    # optional - leave this out and the service will just use its built-in
    # catalog (engine/catalog.py) based on level/preferences. pass it in if you
    # want to score your own specific set of candidates instead
    candidates: Optional[list[Candidate]] = None
    # destinations the user marked "not quite right" - dropped before scoring
    exclude_ids: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def _candidates_not_explicitly_empty(self) -> "RecommendationRequest":
        if self.candidates is not None and not self.candidates:
            raise ValueError("candidates must not be empty when provided")
        return self

    @model_validator(mode="after")
    def _enough_interests(self) -> "RecommendationRequest":
        # Only the organiser's set: it already blends every traveller's picks.
        # member_preferences may carry none (a member who only set a limit).
        usable = set(self.preferences.interests) - set(self.preferences.avoid_interests)
        if len(usable) < MIN_INTERESTS:
            raise ValueError(
                f"preferences.interests needs at least {MIN_INTERESTS} different interests "
                f"that are not in avoid_interests (got {len(usable)})"
            )
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


class MemberFit(BaseModel):
    """How one traveller in the group scores this candidate on their own."""

    label: str
    score: float = Field(ge=0, le=1)
    # the dimension dragging their score down most, so the UI can say who it
    # does not work for and why
    weakest_dimension: Optional[str] = None
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
    # Present only when the request carried several travellers. The group
    # score is not the mean of these - see engine/group.py aggregate_scores.
    member_fit: list[MemberFit] = Field(default_factory=list)
    # how far apart the happiest and least happy member are, 0..1
    fit_spread: Optional[float] = None


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
    # how several travellers' preferences were combined, and the rule that
    # decided each field. null when the request carried only one traveller.
    group_merge: Optional[dict] = None
    group_merge_explanation: Optional[str] = None
    # Disagreements worth telling the group about rather than silently
    # resolving - one member's must-have that another ruled out, say.
    group_conflicts: list[str] = Field(default_factory=list)
