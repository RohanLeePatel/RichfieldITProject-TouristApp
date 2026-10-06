"""The app itself: health check, the routes that are mounted, and the request-id
logging middleware (NFR-29)."""

import logging

import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def client():
    return TestClient(main.app)


def test_health_check(client):
    assert client.get("/").json() == {"status": "ok"}


def test_every_feature_route_is_mounted(client):
    assert set(main.app.openapi()["paths"]) == {
        "/",
        "/landmarks",
        "/ocr",
        "/rates/{base}/{target}",
        "/recommendations",
        "/recommendations/catalog",
        "/text",
        "/weather/{city}",
    }


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
        client.get("/weather/Durban?units=imperial")

    assert "/weather/Durban" in caplog.text
    assert "units=imperial" not in caplog.text
