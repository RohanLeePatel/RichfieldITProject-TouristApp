"""Auth boundary + happy/error path for GET /landmarks, same shape as test_weather.py."""

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.setenv("geoapifyAPIKey", "test-geoapify-key")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import landmarks.landmarks as landmarks_module

    importlib.reload(landmarks_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_landmarks_requires_auth_header(client):
    response = client.get("/landmarks?destination=Cape%20Town&interests=history")
    assert response.status_code == 422


def test_landmarks_rejects_wrong_secret(client):
    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=history", headers={"node-secretkey": "wrong"}
    )
    assert response.status_code == 401


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


def test_landmarks_succeeds_with_correct_secret(client, monkeypatch):
    import landmarks.landmarks as landmarks_module

    def fake_get(url, params=None, timeout=None):
        if url == landmarks_module.GEOCODE_URL:
            return _FakeResponse({"features": [{"geometry": {"coordinates": [18.42, -33.92]}}]})
        return _FakeResponse(
            {
                "features": [
                    {
                        "properties": {
                            "name": "Table Mountain",
                            "categories": ["natural.mountain"],
                            "lat": -33.96,
                            "lon": 18.40,
                            "formatted": "Table Mountain, Cape Town",
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(landmarks_module.requests, "get", fake_get)

    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=nature", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["destination"] == "Cape Town"
    assert len(body["groups"]) == 1
    assert body["groups"][0]["interest"] == "nature"
    assert body["groups"][0]["landmarks"][0]["name"] == "Table Mountain"
    assert body["groups"][0]["landmarks"][0]["distance_m"] > 0


def test_landmarks_resolves_specific_interest_tag(client, monkeypatch):
    """A curated onboarding tag like 'waterparks' should map to a real Geoapify
    category instead of KeyError-ing - see INTEREST_CATEGORY_MAP."""
    import landmarks.landmarks as landmarks_module

    def fake_get(url, params=None, timeout=None):
        if url == landmarks_module.GEOCODE_URL:
            return _FakeResponse({"features": [{"geometry": {"coordinates": [18.42, -33.92]}}]})
        return _FakeResponse({"features": []})

    monkeypatch.setattr(landmarks_module.requests, "get", fake_get)

    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=waterparks",
        headers={"node-secretkey": "test-secret"},
    )
    assert response.status_code == 200
    assert response.json()["groups"][0]["interest"] == "waterparks"


def test_landmarks_destination_not_found_returns_404(client, monkeypatch):
    import landmarks.landmarks as landmarks_module

    monkeypatch.setattr(
        landmarks_module.requests, "get", lambda *a, **k: _FakeResponse({"features": []})
    )

    response = client.get(
        "/landmarks?destination=Nowhereland&interests=history", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 404


def test_landmarks_missing_api_key_returns_503(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.delenv("geoapifyAPIKey", raising=False)
    import config.auth as auth_module

    importlib.reload(auth_module)
    import landmarks.landmarks as landmarks_module

    importlib.reload(landmarks_module)
    import routers.landmarks_router as landmarks_router_module

    importlib.reload(landmarks_router_module)
    import main as main_module

    importlib.reload(main_module)
    client = TestClient(main_module.app)

    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=history", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 503


def test_landmarks_fixes_mojibake_names(client, monkeypatch):
    import landmarks.landmarks as landmarks_module

    def fake_get(url, params=None, timeout=None):
        if url == landmarks_module.GEOCODE_URL:
            return _FakeResponse({"features": [{"geometry": {"coordinates": [18.42, -33.92]}}]})
        return _FakeResponse(
            {
                "features": [
                    {
                        "properties": {
                            # "Company's" mangled the way Geoapify/OSM sometimes returns it.
                            "name": "Companyâ€™s Garden Resturant",
                            "lat": -33.9265,
                            "lon": 18.4166,
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(landmarks_module.requests, "get", fake_get)

    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=food", headers={"node-secretkey": "test-secret"}
    )
    assert response.json()["groups"][0]["landmarks"][0]["name"] == "Company’s Garden Resturant"


def test_fix_mojibake_is_noop_on_clean_text():
    from landmarks.landmarks import _fix_mojibake

    assert _fix_mojibake("Table Mountain") == "Table Mountain"
    assert _fix_mojibake(None) is None


def test_landmarks_requires_at_least_one_interest(client):
    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 422


def test_an_absurdly_long_destination_is_rejected(client):
    long_name = "a" * 101
    response = client.get(
        f"/landmarks?destination={long_name}&interests=history", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 422


def test_without_a_key_the_route_reports_it_is_not_configured(monkeypatch):
    import importlib

    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.delenv("geoapifyAPIKey", raising=False)
    import config.auth as auth_module

    importlib.reload(auth_module)
    import landmarks.landmarks as landmarks_module

    importlib.reload(landmarks_module)
    import main as main_module

    importlib.reload(main_module)

    response = TestClient(main_module.app).get(
        "/landmarks?destination=Cape%20Town&interests=history", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 503


def test_an_unmappable_destination_is_a_404(client, monkeypatch):
    import landmarks.landmarks as landmarks_module

    landmarks_module._geocode_cache.clear()
    monkeypatch.setattr(
        landmarks_module.requests, "get", lambda *a, **k: _FakeResponse({"features": []})
    )

    response = client.get(
        "/landmarks?destination=Nowhereland&interests=history", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 404


def test_a_geocode_failure_falls_back_to_the_expired_position(monkeypatch):
    """NFR-13: a city doesn't move, so an expired entry beats an error."""
    import time

    import landmarks.landmarks as landmarks_module

    landmarks_module._geocode_cache.clear()
    stale = time.monotonic() - landmarks_module.CACHE_TTL_SECONDS - 1
    landmarks_module._geocode_cache[("cape town", 5000)] = ((-33.9, 18.4), stale)

    def boom(*a, **k):
        raise landmarks_module.requests.ConnectionError("provider down")

    monkeypatch.setattr(landmarks_module.requests, "get", boom)
    assert landmarks_module.geocode_destination("Cape Town", 5000) == (-33.9, 18.4)


def test_a_places_failure_falls_back_to_the_expired_results(monkeypatch):
    import time

    import landmarks.landmarks as landmarks_module

    landmarks_module._places_cache.clear()
    stale = time.monotonic() - landmarks_module.CACHE_TTL_SECONDS - 1
    cached = [{"name": "Castle", "lat": -33.9, "lon": 18.4}]
    landmarks_module._places_cache[("-33.9000,18.4000", "history", 5000)] = (cached, stale)

    def boom(*a, **k):
        raise landmarks_module.requests.ConnectionError("provider down")

    monkeypatch.setattr(landmarks_module.requests, "get", boom)
    assert landmarks_module._fetch_places("history", -33.9, 18.4, 5000) == cached


def test_an_unknown_interest_tag_asks_the_provider_for_nothing(monkeypatch):
    import landmarks.landmarks as landmarks_module

    landmarks_module._places_cache.clear()
    monkeypatch.setattr(
        landmarks_module.requests, "get", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no call"))
    )
    assert landmarks_module._fetch_places("underwater-basket-weaving", -33.9, 18.4, 5000) == []


def test_double_encoded_place_names_are_repaired():
    import landmarks.landmarks as landmarks_module

    # "’" (a curly apostrophe) sent as UTF-8 but read as cp1252 upstream
    mojibake = "Smitâ€™s Bar"
    assert landmarks_module._fix_mojibake(mojibake) == "Smit’s Bar"
    # text that is already correct comes back untouched
    assert landmarks_module._fix_mojibake("Café Rouge") == "Café Rouge"
    assert landmarks_module._fix_mojibake(None) is None
    assert landmarks_module._fix_mojibake("") == ""


def test_an_unexpected_provider_error_becomes_a_502(client, monkeypatch):
    import routers.landmarks_router as router_module

    monkeypatch.setattr(
        router_module, "get_landmarks", lambda *a, **k: {"error": "Geoapify is confused", "groups": []}
    )

    response = client.get(
        "/landmarks?destination=Cape%20Town&interests=history", headers={"node-secretkey": "test-secret"}
    )
    assert response.status_code == 502


def test_repeat_lookups_are_served_from_cache(monkeypatch):
    """Geoapify's free tier is shared across the account, so the same city must
    not be geocoded twice (NFR-13)."""
    import landmarks.landmarks as landmarks_module

    landmarks_module._geocode_cache.clear()
    landmarks_module._places_cache.clear()
    calls = []

    def counted_get(url, params=None, timeout=None):
        calls.append(url)
        if url == landmarks_module.GEOCODE_URL:
            return _FakeResponse({"features": [{"geometry": {"coordinates": [18.4, -33.9]}}]})
        return _FakeResponse({"features": [{"properties": {"name": "Castle", "lat": -33.9, "lon": 18.4}}]})

    monkeypatch.setattr(landmarks_module.requests, "get", counted_get)

    first = landmarks_module.get_landmarks("Cape Town", ["history"], 5000)
    second = landmarks_module.get_landmarks("Cape Town", ["history"], 5000)

    assert len(calls) == 2  # one geocode + one places lookup, not four
    assert second == first
