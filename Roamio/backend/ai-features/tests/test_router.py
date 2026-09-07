"""
§7: "test the boundary like a real boundary" — exercises POST
/recommendations through the actual FastAPI app, including the shared-secret
auth header path (§6). The plan's real deployed-Vercel-URL integration test
from Node is out of scope here (no deployment yet); this is the local
equivalent against the app object.
"""

import importlib

import pytest
from fastapi.testclient import TestClient

from tests.test_contract import VALID_PAYLOAD


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    # config.auth reads the env var at import time, so force a fresh import
    # after setting it, and reload the router/app modules that captured the
    # dependency at import time.
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
