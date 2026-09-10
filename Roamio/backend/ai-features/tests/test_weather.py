"""Auth boundary + happy/error path for GET /weather/{city}, same shape as test_router.py."""

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.setenv("openWeatherAPIKey", "test-weather-key")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import weather.weather as weather_module

    importlib.reload(weather_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_weather_does_not_require_frontend_secret(client):
    response = client.get("/weather/Durban")
    assert response.status_code != 422


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code
        self.ok = status_code == 200

    def json(self):
        return self._payload


def test_weather_succeeds_with_correct_secret(client, monkeypatch):
    import weather.weather as weather_module

    def fake_get(url, params=None, timeout=None):
        if url.endswith("/weather"):
            return _FakeResponse({
                "name": params["q"],
                "weather": [{"description": "clear sky"}],
                "main": {"temp": 22.0, "feels_like": 21.0, "humidity": 50},
                "wind": {"speed": 3.0},
            })
        return _FakeResponse({
            "list": [{"dt_txt": "2026-09-09 12:00:00", "weather": [{"description": "clear sky"}], "main": {"temp": 23.0, "humidity": 45}}]
        })

    monkeypatch.setattr(weather_module.requests, "get", fake_get)

    response = client.get("/weather/Durban")
    assert response.status_code == 200
    body = response.json()
    assert body["city"] == "Durban"
    assert body["current"]["temp"] == 22.0
    assert body["forecast"] == [{"date": "2026-09-09", "description": "clear sky", "temp": 23.0, "humidity": 45}]


def test_weather_city_not_found_returns_404(client, monkeypatch):
    import weather.weather as weather_module

    monkeypatch.setattr(weather_module.requests, "get", lambda *a, **k: _FakeResponse({}, status_code=404))

    response = client.get("/weather/Nowhereland")
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

    response = client.get("/weather/Durban")
    assert response.status_code == 503
