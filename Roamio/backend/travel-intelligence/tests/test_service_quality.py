"""
The shared plumbing added to make the service easier to run and to read:
configuration registry, the HTTP client, "degraded" flags and exclusion hints.
"""

import importlib
from pathlib import Path

import pytest
import requests
from fastapi.testclient import TestClient

import http_client
from config import settings
from engine.gates import suggest_fix
from engine.pipeline import score_candidates
from tests.conftest import make_candidate, make_prefs
from tests.test_contract import VALID_PAYLOAD

SECRET = {"node-secretkey": "test-secret"}
ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# configuration
# ---------------------------------------------------------------------------


def test_env_example_lists_exactly_the_registered_settings():
    listed = {
        line.split("=")[0].strip().lstrip("# ").strip()
        for line in (ROOT / ".env.example").read_text(encoding="utf-8").splitlines()
        if "=" in line
    }
    assert listed == {s.name for s in settings.SETTINGS}


def test_reading_an_unregistered_setting_is_an_error():
    with pytest.raises(KeyError):
        settings.get("somethingElse")


def test_get_treats_empty_as_unset(monkeypatch):
    monkeypatch.setenv("geminiModel", "")
    assert settings.get("geminiModel", "fallback") == "fallback"
    monkeypatch.setenv("geminiModel", "m")
    assert settings.get("geminiModel", "fallback") == "m"


def test_missing_keys_are_logged_with_what_stops_working(monkeypatch, caplog):
    for s in settings.SETTINGS:
        monkeypatch.delenv(s.name, raising=False)
    with caplog.at_level("WARNING", logger="config.settings"):
        settings.check_environment()
    assert "superSecretKey is not set" in caplog.text and "geoapifyAPIKey is not set: landmarks" in caplog.text
    assert "geminiModel" not in caplog.text  # has a default, so it is not a gap
    assert any(r.levelname == "ERROR" and "superSecretKey" in r.getMessage() for r in caplog.records)


# ---------------------------------------------------------------------------
# http client
# ---------------------------------------------------------------------------


class Reply:
    def __init__(self, status_code):
        self.status_code = status_code


def script(monkeypatch, *outcomes):
    """requests.get answers with each outcome in turn; an exception instance is raised."""
    calls = []

    def fake(url, **kwargs):
        calls.append((url, kwargs))
        outcome = outcomes[min(len(calls), len(outcomes)) - 1]
        if isinstance(outcome, Exception):
            raise outcome
        return Reply(outcome)

    monkeypatch.setattr(requests, "get", fake)
    return calls


def test_a_good_answer_is_returned_after_one_call(monkeypatch):
    calls = script(monkeypatch, 200)
    assert http_client.get("https://x").status_code == 200
    assert len(calls) == 1 and calls[0][1]["timeout"] == http_client.DEFAULT_TIMEOUT_SECONDS


def test_a_clear_no_is_not_retried(monkeypatch):
    calls = script(monkeypatch, 403)
    assert http_client.get("https://x").status_code == 403
    assert len(calls) == 1


def test_a_server_error_or_dropped_connection_is_retried_once(monkeypatch):
    calls = script(monkeypatch, 503, 200)
    assert http_client.get("https://x").status_code == 200 and len(calls) == 2
    calls = script(monkeypatch, requests.ConnectionError(), 200)
    assert http_client.get("https://x").status_code == 200 and len(calls) == 2


def test_the_last_failure_is_what_the_caller_sees(monkeypatch):
    calls = script(monkeypatch, 500)
    assert http_client.get("https://x").status_code == 500 and len(calls) == 2
    calls = script(monkeypatch, requests.Timeout())
    with pytest.raises(requests.Timeout):
        http_client.get("https://x")
    assert len(calls) == 2


def test_retries_can_be_turned_off_and_post_uses_post(monkeypatch):
    calls = script(monkeypatch, 500)
    http_client.get("https://x", retries=0)
    assert len(calls) == 1
    seen = []
    monkeypatch.setattr(requests, "post", lambda url, **kw: seen.append(kw) or Reply(200))
    http_client.post("https://x", json={"a": 1})
    assert seen == [{"json": {"a": 1}, "timeout": http_client.DEFAULT_TIMEOUT_SECONDS}]


def test_describing_an_error_never_includes_its_message():
    error = requests.ConnectionError("HTTPSConnectionPool: /v2/places?apiKey=SECRET")
    assert http_client.describe_error(error) == "ConnectionError"


# ---------------------------------------------------------------------------
# degraded flags
# ---------------------------------------------------------------------------


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def two_country_request(**changes):
    cities = [
        {"id": "a", "name": "Alpha", "country": "Aland", "features": {"cost_index": 2}},
        {"id": "b", "name": "Beta", "country": "Bland", "features": {"cost_index": 2}},
    ]
    return {**VALID_PAYLOAD, "level": "country", "candidates": cities, **changes}


def test_nothing_is_flagged_when_nothing_is_missing(client, monkeypatch):
    import routers.recommendations_router as router

    monkeypatch.setattr(router, "advisory_levels", lambda: {"aland": 1, "bland": 2})
    monkeypatch.setattr(router, "rate_unavailable", lambda currency: False)
    response = client.post("/v1/recommendations", json=two_country_request(), headers=SECRET)
    assert response.status_code == 200 and response.json()["degraded"] == []


def test_missing_safety_levels_are_flagged(client, monkeypatch):
    import routers.recommendations_router as router

    monkeypatch.setattr(router, "advisory_levels", lambda: {})
    monkeypatch.setattr(router, "rate_unavailable", lambda currency: False)
    assert client.post("/v1/recommendations", json=two_country_request(), headers=SECRET).json()["degraded"] == ["safety"]


def test_a_single_country_run_never_claims_safety_is_missing(client, monkeypatch):
    import routers.recommendations_router as router

    def must_not_be_asked():
        raise AssertionError("safety is not used for one country")

    monkeypatch.setattr(router, "advisory_levels", must_not_be_asked)
    monkeypatch.setattr(router, "rate_unavailable", lambda currency: False)
    one_country = [{"id": "a", "name": "Alpha", "country": "Aland", "features": {"cost_index": 2}}]
    response = client.post("/v1/recommendations", json=two_country_request(candidates=one_country, level="city"), headers=SECRET)
    assert response.json()["degraded"] == []


def test_an_unavailable_exchange_rate_is_flagged(client, monkeypatch):
    import routers.recommendations_router as router

    monkeypatch.setattr(router, "advisory_levels", lambda: {"aland": 1, "bland": 1})
    monkeypatch.setattr(router, "rate_unavailable", lambda currency: True)
    assert client.post("/v1/recommendations", json=two_country_request(), headers=SECRET).json()["degraded"] == ["currency"]


# ---------------------------------------------------------------------------
# what would bring an excluded place back
# ---------------------------------------------------------------------------


def test_over_budget_places_say_what_budget_would_include_them():
    prefs = make_prefs(budget_per_day=1000, interests=["history", "nature", "food"])
    pricey = make_candidate("p", "Pricey", cost_index=5)  # band 5 starts at R2,500
    assert suggest_fix(prefs, pricey) == "Raise your budget to about 2500 ZAR a day to include it."
    _, excluded, _ = score_candidates(prefs, "city", [pricey, make_candidate("c", "Cheap", cost_index=1)])
    assert excluded[0].id == "p" and "2500" in excluded[0].suggestion


def test_inaccessible_places_say_to_relax_the_wheelchair_requirement():
    prefs = make_prefs(budget_per_day=5000, wheelchair="required")
    poor = make_candidate("x", "Steps", accessibility="poor", accessible_ratio=0.02, tagged_total=40)
    assert "required to preferred" in suggest_fix(prefs, poor)


def test_a_place_that_is_not_gated_has_no_suggestion():
    prefs = make_prefs(budget_per_day=5000)
    assert suggest_fix(prefs, make_candidate("ok", "Fine", cost_index=2)) is None
