"""Checks that bad requests actually get rejected by the pydantic models
instead of silently getting coerced into something that looks valid."""

import pytest
from pydantic import ValidationError

from schemas.recommendations import RecommendationRequest

VALID_PAYLOAD = {
    "request_id": "11111111-1111-1111-1111-111111111111",
    "session_id": "22222222-2222-2222-2222-222222222222",
    "level": "city",
    "parent_id": "za",
    "preferences": {
        "budget_per_day": 850,
        "currency": "ZAR",
        "interests": ["history", "nature", "food"],
        "travellers": {"adults": 2, "children": [4, 9]},
        "accessibility": {"wheelchair": "preferred"},
        "climate": {"prefer": "mild", "travel_month": 12},
        "pace": "balanced",
    },
    "candidates": [{"id": "za-dbn", "name": "Durban", "features": {"cost_index": 2}}],
}


def test_valid_payload_parses():
    RecommendationRequest.model_validate(VALID_PAYLOAD)


def _with_interests(interests, avoid=()):
    prefs = {**VALID_PAYLOAD["preferences"], "interests": interests, "avoid_interests": list(avoid)}
    return {**VALID_PAYLOAD, "preferences": prefs}


@pytest.mark.parametrize(
    "interests, avoid",
    [
        ([], []),
        (["food", "nature"], []),
        (["food", "food", "nature"], []),  # duplicates count once
        (["food", "nature", "history"], ["history"]),  # an avoided one doesn't count
    ],
)
def test_fewer_than_three_usable_interests_rejected(interests, avoid):
    with pytest.raises(ValidationError, match="at least 3"):
        RecommendationRequest.model_validate(_with_interests(interests, avoid))


def test_three_usable_interests_accepted():
    RecommendationRequest.model_validate(_with_interests(["food", "nature", "history"]))


def test_members_may_have_no_interests_of_their_own():
    member = {**VALID_PAYLOAD["preferences"], "interests": []}
    RecommendationRequest.model_validate({**VALID_PAYLOAD, "member_preferences": [member]})


def test_empty_candidates_rejected():
    payload = {**VALID_PAYLOAD, "candidates": []}
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_invalid_level_rejected():
    payload = {**VALID_PAYLOAD, "level": "planet"}
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_negative_budget_rejected():
    payload = {
        **VALID_PAYLOAD,
        "preferences": {**VALID_PAYLOAD["preferences"], "budget_per_day": -10},
    }
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_out_of_range_cost_index_rejected():
    payload = {
        **VALID_PAYLOAD,
        "candidates": [{"id": "x", "name": "X", "features": {"cost_index": 9}}],
    }
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_invalid_travel_month_rejected():
    payload = {
        **VALID_PAYLOAD,
        "preferences": {
            **VALID_PAYLOAD["preferences"],
            "climate": {"prefer": "mild", "travel_month": 13},
        },
    }
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_missing_required_field_rejected():
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "preferences"}
    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_nested_children_candidates_parse():
    payload = {
        **VALID_PAYLOAD,
        "level": "country",
        "candidates": [
            {
                "id": "za",
                "name": "South Africa",
                "features": {"cost_index": 2},
                "children": [{"id": "za-dbn", "name": "Durban", "features": {"cost_index": 2}}],
            }
        ],
    }
    request = RecommendationRequest.model_validate(payload)
    assert request.candidates[0].children[0].id == "za-dbn"
