"""GET /places/search: is a named place within reach of the trip (FR-37)? Geoapify is stubbed."""

import importlib

import pytest
from fastapi.testclient import TestClient

SECRET = {"node-secretkey": "test-secret"}
URL = "/places/search?text=uShaka%20Marine%20World&near=Durban"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    monkeypatch.setenv("geoapifyAPIKey", "test-geoapify-key")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import landmarks.landmarks as landmarks_module

    importlib.reload(landmarks_module)
    import routers.landmarks_router as router_module

    importlib.reload(router_module)
    import main as main_module

    importlib.reload(main_module)
    landmarks_module._geocode_cache.clear()
    return TestClient(main_module.app), landmarks_module


class _Response:
    def __init__(self, payload=None, fail=False):
        self._payload, self._fail = payload or {}, fail

    def raise_for_status(self):
        if self._fail:
            raise Exception("boom")

    def json(self):
        return self._payload


def _feature(confidence=1, result_type="amenity", name="uShaka Marine World", lat=-29.865, lon=31.045):
    return {
        "properties": {
            "name": name, "formatted": f"{name}, Durban, South Africa", "lat": lat, "lon": lon,
            "result_type": result_type, "rank": {"confidence": confidence},
        }
    }


def _stub(monkeypatch, module, search_features, anchor=(-29.8587, 31.0218)):
    """The first request (no filter) geocodes the city; the one with a filter is the search."""
    seen = []

    def fake_get(url, params, timeout):
        seen.append(params)
        if "filter" in params:
            return _Response({"features": search_features})
        return _Response({"features": [{"geometry": {"coordinates": [anchor[1], anchor[0]]}}]})

    monkeypatch.setattr(module.requests, "get", fake_get)
    return seen


def test_requires_service_key(client):
    http, _ = client
    assert http.get(URL).status_code == 422
    assert http.get(URL, headers={"node-secretkey": "wrong"}).status_code == 401


def test_finds_the_place_near_the_city(client, monkeypatch):
    http, module = client
    seen = _stub(monkeypatch, module, [_feature()])
    body = http.get(URL, headers=SECRET).json()
    assert body["found"] is True
    assert body["name"] == "uShaka Marine World"
    assert body["lat"] == -29.865 and 0 < body["distance_m"] < 5000
    # the search is limited to a circle around the city, and prefers what is closest to it
    search = seen[-1]
    assert search["filter"].startswith("circle:31.0218,-29.8587,") and search["bias"].startswith("proximity:")


def test_uses_the_given_anchor_instead_of_geocoding_the_city(client, monkeypatch):
    http, module = client
    seen = _stub(monkeypatch, module, [_feature()])
    http.get(URL + "&lat=-29.9&lon=31.0", headers=SECRET)
    assert len(seen) == 1 and seen[0]["filter"].startswith("circle:31.0,-29.9,")


def test_not_found_when_nothing_is_nearby_or_the_match_is_weak_or_too_coarse(client, monkeypatch):
    http, module = client
    for features in ([], [_feature(confidence=0)], [_feature(result_type="country")]):
        _stub(monkeypatch, module, features)
        response = http.get(URL, headers=SECRET)
        assert response.status_code == 200
        assert response.json()["found"] is False


def test_failures_are_not_a_not_found(client, monkeypatch):
    http, module = client
    monkeypatch.setattr(module.requests, "get", lambda url, params, timeout: _Response(fail=True))
    assert http.get(URL + "&lat=1&lon=1", headers=SECRET).status_code == 502
    module._geocode_cache.clear()
    monkeypatch.setattr(module.requests, "get", lambda url, params, timeout: _Response({"features": []}))
    assert http.get(URL, headers=SECRET).status_code == 502  # the city itself could not be located
    monkeypatch.setattr(module, "GEOAPIFY_API_KEY", None)
    assert http.get(URL, headers=SECRET).status_code == 503
