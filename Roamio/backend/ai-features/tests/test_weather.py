"""Auth boundary + happy/error path for GET /weather/{city}, same shape as test_router.py."""

import importlib

import pytest
import requests
from fastapi.testclient import TestClient

SECRET = {"node-secretkey": "test-secret"}
API_KEY = "test-weather-key"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.setenv("openWeatherAPIKey", API_KEY)
    import config.auth as auth_module

    importlib.reload(auth_module)
    import weather.weather as weather_module

    importlib.reload(weather_module)
    import routers.weather_router as weather_router_module

    importlib.reload(weather_router_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_weather_requires_auth_header(client):
    response = client.get("/weather/Durban")
    assert response.status_code == 422  # FastAPI: missing required header


def test_weather_rejects_wrong_secret(client):
    response = client.get("/weather/Durban", headers={"node-secretkey": "wrong"})
    assert response.status_code == 401


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.ok = status_code == 200

    def json(self):
        return self._payload


def _fake_get(url, params=None, timeout=None):
    if url.endswith("/weather"):
        return _FakeResponse({
            "name": params["q"],
            "weather": [{"description": "clear sky"}],
            "main": {"temp": 22.0, "feels_like": 21.0, "humidity": 50},
            "wind": {"speed": 3.0},
            "rain": {"1h": 0.4},
        })
    return _FakeResponse({
        "list": [{
            "dt_txt": "2026-09-09 12:00:00",
            "weather": [{"description": "clear sky"}],
            "main": {"temp": 23.0, "humidity": 45},
            "wind": {"speed": 4.5},
            "pop": 0.42,
        }]
    })


def test_weather_succeeds_with_correct_secret(client, monkeypatch):

    monkeypatch.setattr(requests, "get", _fake_get)

    response = client.get("/weather/Durban", headers=SECRET)
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Durban"
    assert body["current"]["temp"] == 22.0
    assert body["current"]["wind_speed"] == 3.0
    assert body["current"]["precipitation_mm"] == 0.4
    assert body["stale"] is False
    assert body["fetched_at"]  # "last updated" label (NFR-13)
    assert body["forecast"] == [{
        "date": "2026-09-09",
        "description": "clear sky",
        "temp": 23.0,
        "humidity": 45,
        "wind_speed": 4.5,
        "precipitation_chance": 42,
        "precipitation_mm": None,
    }]


def test_weather_city_not_found_returns_404(client, monkeypatch):

    monkeypatch.setattr(requests, "get", lambda *a, **k: _FakeResponse({}, status_code=404))

    response = client.get("/weather/Nowhereland", headers=SECRET)
    assert response.status_code == 404


def test_weather_missing_api_key_returns_503(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.delenv("openWeatherAPIKey", raising=False)
    import config.auth as auth_module

    importlib.reload(auth_module)
    import weather.weather as weather_module

    importlib.reload(weather_module)
    import routers.weather_router as weather_router_module

    importlib.reload(weather_router_module)
    import main as main_module

    importlib.reload(main_module)
    client = TestClient(main_module.app)

    response = client.get("/weather/Durban", headers=SECRET)
    assert response.status_code == 503


def test_second_request_is_served_from_cache(client, monkeypatch):

    calls = []

    def counted_get(url, params=None, timeout=None):
        calls.append(url)
        return _fake_get(url, params, timeout)

    monkeypatch.setattr(requests, "get", counted_get)

    first = client.get("/weather/Durban", headers=SECRET).json()
    second = client.get("/weather/DURBAN", headers=SECRET).json()  # same key, different case
    assert len(calls) == 2  # current + forecast, once
    assert second == first


def test_provider_failure_serves_the_cached_answer_as_stale(client, monkeypatch):
    import weather.weather as weather_module

    monkeypatch.setattr(requests, "get", _fake_get)
    fresh = client.get("/weather/Durban", headers=SECRET).json()

    # expire the entry, then make the provider fail
    weather_module._weather_cache[("durban", "metric")] = (
        fresh,
        -weather_module.CACHE_TTL_SECONDS,
    )

    def boom(*a, **k):
        raise requests.exceptions.ConnectionError("provider down")

    monkeypatch.setattr(requests, "get", boom)

    response = client.get("/weather/Durban", headers=SECRET)
    assert response.status_code == 200
    body = response.json()
    assert body["stale"] is True
    assert body["current"]["temp"] == 22.0
    assert body["fetched_at"] == fresh["fetched_at"]


def test_provider_failure_without_a_cached_answer_returns_502(client, monkeypatch):

    def boom(*a, **k):
        raise requests.exceptions.ConnectionError("provider down")

    monkeypatch.setattr(requests, "get", boom)

    response = client.get("/weather/Durban", headers=SECRET)
    assert response.status_code == 502


def test_provider_error_never_leaks_the_api_key(client, monkeypatch):
    """requests puts the full URL in its exception text, and the URL carries
    `appid=<key>`, so the message must not be passed through."""

    def boom(*a, **k):
        raise requests.exceptions.ConnectionError(
            f"Max retries exceeded with url: /data/2.5/weather?q=Durban&appid={API_KEY}"
        )

    monkeypatch.setattr(requests, "get", boom)

    response = client.get("/weather/Durban", headers=SECRET)
    assert API_KEY not in response.text


def test_http_error_from_the_provider_hides_the_status_detail(client, monkeypatch):

    monkeypatch.setattr(
        requests, "get", lambda *a, **k: _FakeResponse({}, status_code=401)
    )

    response = client.get("/weather/Durban", headers=SECRET)
    assert response.status_code == 502
    assert "401" not in response.json()["detail"]


def test_an_absurdly_long_city_is_rejected_before_the_provider(client, monkeypatch):

    def never(*a, **k):
        raise AssertionError("should not reach the weather provider")

    monkeypatch.setattr(requests, "get", never)

    assert client.get("/weather/" + "a" * 101, headers=SECRET).status_code == 422
