"""
Hits POST /recommendations through the actual FastAPI app (not just the
functions directly), auth header included, so we're testing the real
boundary Node will actually call. Not testing the deployed Vercel URL from
Node itself here - this is the local equivalent against the app object.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

from tests.test_contract import VALID_PAYLOAD
from engine.catalog import load_city_candidates, load_country_catalog


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    # config.auth reads the env var at import time, so it needs a fresh reload
    # after setting it, and same for the router/app that already imported it
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_recommendations_requires_auth_header(client):
    response = client.post("/recommendations", json=VALID_PAYLOAD)
    assert response.status_code == 422  # FastAPI: missing required header


def test_recommendations_rejects_wrong_secret(client):
    response = client.post(
        "/recommendations", json=VALID_PAYLOAD, headers={"node-secretkey": "wrong"}
    )
    assert response.status_code == 401


def test_recommendations_succeeds_with_correct_secret(client):
    response = client.post(
        "/recommendations", json=VALID_PAYLOAD, headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["level"] == "city"
    assert len(body["results"]) == 1
    assert body["results"][0]["id"] == "za-dbn"


def test_recommendations_rejects_malformed_body(client):
    response = client.post(
        "/recommendations",
        json={"level": "city"},
        headers={"node-secretkey": "test-secret"},
    )
    assert response.status_code == 422


def test_recommendations_uses_seed_catalog_when_candidates_omitted(client):
    payload = {**VALID_PAYLOAD}
    del payload["candidates"]
    del payload["parent_id"]
    response = client.post(
        "/recommendations", json=payload, headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) + len(body["excluded"]) == len(load_city_candidates())


def test_recommendations_rejects_omitted_candidates_at_place_level(client):
    payload = {**VALID_PAYLOAD, "level": "place"}
    del payload["candidates"]
    response = client.post(
        "/recommendations", json=payload, headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 400


def test_recommendations_country_level_uses_synthesized_catalog(client):
    payload = {**VALID_PAYLOAD, "level": "country"}
    del payload["candidates"]
    del payload["parent_id"]
    response = client.post(
        "/recommendations", json=payload, headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["results"]) + len(body["excluded"]) == len(load_country_catalog())
    result_ids = {r["id"] for r in body["results"]}
    assert "south-africa" in result_ids


def test_recommendations_city_level_filters_by_parent_country(client):
    payload = {**VALID_PAYLOAD, "level": "city", "parent_id": "south-africa"}
    del payload["candidates"]
    response = client.post(
        "/recommendations", json=payload, headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 200
    body = response.json()
    result_ids = {r["id"] for r in body["results"]} | {e["id"] for e in body["excluded"]}
    assert result_ids == {c.id for c in load_city_candidates(country_id="south-africa")}


def test_recommendations_city_level_unknown_parent_country_404s(client):
    payload = {**VALID_PAYLOAD, "level": "city", "parent_id": "atlantis"}
    del payload["candidates"]
    response = client.post(
        "/recommendations", json=payload, headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 404
