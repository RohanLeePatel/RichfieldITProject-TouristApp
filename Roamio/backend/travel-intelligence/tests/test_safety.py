import requests

import engine.safety as safety
from tests.conftest import make_candidate


class _Response:
    def __init__(self, payload, status=200):
        self._payload = payload
        self._status = status

    def raise_for_status(self):
        if self._status >= 400:
            raise requests.HTTPError(f"{self._status}")

    def json(self):
        return self._payload


LEVELS = {"data": [
    {"iso_code": "IDN", "name": "Indonesia", "advisory_level": 2},
    {"iso_code": "CZE", "name": "Czechia", "advisory_level": 1},
    {"iso_code": "AFG", "name": "Afghanistan", "advisory_level": 4},
]}


def _country(name, safety_index=None, children=()):
    candidate = make_candidate(name.lower(), name, safety_index=safety_index, children=list(children))
    return candidate.model_copy(update={"country": name})


def test_levels_fetched_once_and_cached(monkeypatch):
    monkeypatch.setattr(safety, "TRAVEL_RISK_API_KEY", "test-key")
    calls = []

    def _get(url, params, headers, timeout):
        calls.append((url, params, headers))
        return _Response(LEVELS)

    monkeypatch.setattr(requests, "get", _get)
    assert safety.advisory_levels() == {"indonesia": 2, "czechia": 1, "afghanistan": 4}
    safety.advisory_levels()
    assert len(calls) == 1
    assert calls[0][1] == {"limit": 1000}
    assert calls[0][2] == {"X-API-Key": "test-key"}


def test_no_key_or_failure_means_no_levels(monkeypatch):
    assert safety.advisory_levels() == {}

    monkeypatch.setattr(safety, "TRAVEL_RISK_API_KEY", "test-key")
    monkeypatch.setattr(requests, "get", lambda *a, **k: _Response({}, status=429))
    assert safety.advisory_levels() == {}


def test_failure_serves_the_last_levels(monkeypatch):
    monkeypatch.setattr(safety, "TRAVEL_RISK_API_KEY", "test-key")
    monkeypatch.setattr(requests, "get", lambda *a, **k: _Response(LEVELS))
    safety.advisory_levels()
    # expire the entry, then fail
    levels, _ = safety._levels_cache["levels"]
    safety._levels_cache["levels"] = (levels, -safety.CACHE_TTL_SECONDS)
    monkeypatch.setattr(requests, "get", lambda *a, **k: _Response({}, status=500))
    assert safety.advisory_levels()["indonesia"] == 2


def test_safety_index_from_level():
    levels = {"indonesia": 2, "czechia": 1, "afghanistan": 4}
    assert safety.safety_index("Indonesia", levels) == 0.67
    assert safety.safety_index("Czech Republic", levels) == 1.0  # catalog name -> API name
    assert safety.safety_index("Afghanistan", levels) == 0.0
    assert safety.safety_index("Atlantis", levels) is None
    assert safety.safety_index(None, levels) is None


def test_with_safety_fills_countries_and_their_cities(monkeypatch):
    monkeypatch.setattr(safety, "advisory_levels", lambda: {"indonesia": 2, "czechia": 1})
    bali = _country("Indonesia").model_copy(update={"id": "id-bali", "name": "Bali"})
    filled = safety.with_safety([
        _country("Indonesia", children=[bali]),
        _country("Czech Republic"),
        _country("Atlantis"),
        _country("Kenya", safety_index=0.4),  # a seeded value is kept
    ])
    assert [c.features.safety_index for c in filled] == [0.67, 1.0, None, 0.4]
    assert filled[0].children[0].features.safety_index == 0.67


def test_with_safety_skips_single_country_runs(monkeypatch):
    def _never():
        raise AssertionError("one country: nothing to compare, so no lookup")

    monkeypatch.setattr(safety, "advisory_levels", _never)
    cities = [_country("Indonesia"), _country("Indonesia")]
    assert safety.with_safety(cities) == cities


def test_with_safety_without_levels_changes_nothing(monkeypatch):
    monkeypatch.setattr(safety, "advisory_levels", lambda: {})
    countries = [_country("Indonesia"), _country("Czech Republic")]
    assert safety.with_safety(countries) == countries
