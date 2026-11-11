"""The app itself: health check, the routes that are mounted, and the request-id
logging middleware (NFR-29)."""

import importlib
import logging

import pytest
from fastapi.testclient import TestClient

import main

SECRET = {"node-secretkey": "test-secret"}


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def authed_client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_health_check(client):
    assert client.get("/").json() == {"status": "ok"}


FEATURE_ROUTES = {
    "/chat",
    "/destinations/enrich",
    "/destinations/geocode",
    "/landmarks",
    "/places/search",
    "/ocr",
    "/rates/{base}/{target}",
    "/recommendations",
    "/recommendations/catalog",
    "/text",
    "/weather/{city}",
    "/api/translate/camera",
    "/api/translate/history",
    "/api/translate/history/{record_id}",
    "/api/translate/text",
}


def test_every_feature_route_is_mounted_under_v1(client):
    paths = set(main.app.openapi()["paths"])
    # uptime and tooling stay unversioned; the legacy copies are hidden from the schema
    assert paths == {"/", "/health"} | {"/v1" + route for route in FEATURE_ROUTES}


def test_the_old_unversioned_paths_still_answer(authed_client):
    """until the Core API has moved to /v1, nothing may break"""
    for prefix in ("", "/v1"):
        response = authed_client.get(f"{prefix}/rates/ZAR/ZAR", headers=SECRET)
        assert response.status_code == 200, prefix


def test_every_error_has_a_message_and_a_stable_code(authed_client):
    missing_key = authed_client.get("/v1/rates/ZAR/ZAR")
    assert missing_key.status_code == 422
    assert missing_key.json()["code"] == "invalid_request"
    assert "node_secretkey" in missing_key.json()["message"].lower() or "node-secretkey" in missing_key.json()["message"].lower()
    assert isinstance(missing_key.json()["detail"], list)  # what callers always got is still there

    wrong_key = authed_client.get("/v1/rates/ZAR/ZAR", headers={"node-secretkey": "nope"})
    assert wrong_key.json() == {"message": "Unauthorized", "code": "unauthorized", "detail": "Unauthorized"}

    unknown = authed_client.get("/v1/nowhere", headers=SECRET)
    assert unknown.status_code == 404 and unknown.json()["code"] == "not_found"


def test_the_request_id_from_the_core_api_is_echoed_and_logged(client, caplog):
    with caplog.at_level(logging.INFO, logger="roamio.access"):
        response = client.get("/", headers={"X-Request-ID": "abc-123"})

    assert response.headers["X-Request-ID"] == "abc-123"
    assert "GET / -> 200" in caplog.text and "abc-123" in caplog.text


def test_a_request_without_an_id_gets_one(client):
    first = client.get("/").headers["X-Request-ID"]
    second = client.get("/").headers["X-Request-ID"]
    assert first and second and first != second


def test_the_log_line_carries_no_query_string(client, caplog):
    """Interests, destinations and radius travel in the query string - keep them
    out of the log."""
    with caplog.at_level(logging.INFO, logger="roamio.access"):
        client.get("/?units=imperial")  # any route; this one needs no provider

    assert "GET / ->" in caplog.text
    assert "units=imperial" not in caplog.text


def test_health_detail_requires_the_service_key(client):
    assert client.get("/health").status_code == 422


def test_health_detail_reports_which_providers_are_configured(authed_client, monkeypatch):
    """FR-25: an administrator can see what this instance can actually serve."""
    import weather.weather as weather_module

    monkeypatch.setattr(weather_module, "OPENWEATHER_API_KEY", "a-key")

    body = authed_client.get("/health", headers=SECRET).json()
    assert body["status"] == "ok"
    assert body["providers"]["weather"] is True
    assert set(body["providers"]) == {
        "weather", "ocr", "translation", "landmarks", "exchange_rates", "chat"
    }
    # the key itself must never appear
    assert "a-key" not in authed_client.get("/health", headers=SECRET).text


def test_the_schema_is_served_only_with_the_service_key(authed_client):
    assert authed_client.get("/openapi.json").status_code == 422
    assert authed_client.get("/openapi.json", headers=SECRET).json()["info"]["title"]


def test_the_hosted_docs_pages_are_off(client):
    assert client.get("/docs").status_code == 404
    assert client.get("/redoc").status_code == 404


def test_every_response_carries_the_security_headers():
    from fastapi.testclient import TestClient

    import main

    response = TestClient(main.app).get("/")
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "no-referrer"
