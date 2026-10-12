"""Auth boundary + happy/error path for GET /rates/{base}/{target} (FR-13)."""

import importlib

import pytest
from fastapi.testclient import TestClient

import engine.currency as currency

SECRET = {"node-secretkey": "test-secret"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    currency._rate_cache.clear()
    yield TestClient(main_module.app)
    currency._rate_cache.clear()


class _Response:
    def raise_for_status(self):
        pass

    def json(self):
        return {"result": "success", "conversion_rate": 0.055}


def test_rates_requires_auth_header(client):
    assert client.get("/rates/ZAR/USD").status_code == 422


def test_rates_rejects_wrong_secret(client):
    assert client.get("/rates/ZAR/USD", headers={"node-secretkey": "wrong"}).status_code == 401


def test_rates_returns_the_rate_and_when_it_was_fetched(client, monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    monkeypatch.setattr(currency.requests, "get", lambda url, timeout: _Response())

    response = client.get("/rates/zar/usd", headers=SECRET)
    assert response.status_code == 200
    body = response.json()
    assert body["base"] == "ZAR" and body["target"] == "USD"
    assert body["rate"] == 0.055 and body["stale"] is False
    assert body["fetched_at"]


def test_rates_rejects_a_code_that_is_not_three_letters(client):
    assert client.get("/rates/ZAR/DOLLAR", headers=SECRET).status_code == 422
    assert client.get("/rates/ZAR/12", headers=SECRET).status_code == 422


def test_rates_returns_503_when_no_rate_is_available(client, monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", None)

    response = client.get("/rates/ZAR/USD", headers=SECRET)
    assert response.status_code == 503
