"""Per-caller rate limiting (NFR-30)."""

import importlib
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import rate_limit
from rate_limit import check_rate_limit


def fake_request(path="/weather/Durban", key=None, forwarded=None, host="1.2.3.4"):
    headers = {}
    if key:
        headers["node-secretkey"] = key
    if forwarded:
        headers["x-forwarded-for"] = forwarded
    return SimpleNamespace(
        url=SimpleNamespace(path=path),
        headers=headers,
        client=SimpleNamespace(host=host),
    )


@pytest.fixture(autouse=True)
def _clear_hits():
    rate_limit._hits.clear()
    yield
    rate_limit._hits.clear()


def test_requests_under_the_limit_pass(monkeypatch):
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/weather", 3)
    assert [check_rate_limit(fake_request(key="k")) for _ in range(3)] == [None, None, None]


def test_the_request_over_the_limit_gets_a_retry_after(monkeypatch):
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/weather", 2)
    for _ in range(2):
        check_rate_limit(fake_request(key="k"), now=100.0)

    retry_after = check_rate_limit(fake_request(key="k"), now=100.0)
    assert retry_after == rate_limit.WINDOW_SECONDS


def test_the_window_resets(monkeypatch):
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/weather", 1)
    assert check_rate_limit(fake_request(key="k"), now=100.0) is None
    assert check_rate_limit(fake_request(key="k"), now=100.0) is not None
    # a minute later the budget is fresh
    assert check_rate_limit(fake_request(key="k"), now=100.0 + rate_limit.WINDOW_SECONDS) is None


def test_each_application_gets_its_own_budget(monkeypatch):
    """The point of keying on the service key: a second app can't spend the
    Core API's allowance."""
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/weather", 1)
    assert check_rate_limit(fake_request(key="core-api")) is None
    assert check_rate_limit(fake_request(key="core-api")) is not None
    assert check_rate_limit(fake_request(key="another-app")) is None


def test_each_route_has_its_own_budget(monkeypatch):
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/weather", 1)
    assert check_rate_limit(fake_request("/weather/Durban", key="k")) is None
    assert check_rate_limit(fake_request("/weather/Durban", key="k")) is not None
    assert check_rate_limit(fake_request("/ocr", key="k")) is None


def test_a_sub_path_counts_against_its_route(monkeypatch):
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/recommendations", 1)
    assert check_rate_limit(fake_request("/recommendations", key="k")) is None
    assert check_rate_limit(fake_request("/recommendations/catalog", key="k")) is not None


def test_callers_without_a_key_are_grouped_by_address(monkeypatch):
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/weather", 1)
    # the first hop in X-Forwarded-For, not the proxy that delivered it
    assert check_rate_limit(fake_request(forwarded="9.9.9.9, 10.0.0.1")) is None
    assert check_rate_limit(fake_request(forwarded="9.9.9.9, 10.0.0.2")) is not None
    assert check_rate_limit(fake_request(forwarded="8.8.8.8")) is None


def test_the_raw_key_is_never_held_in_the_counter_table():
    check_rate_limit(fake_request(key="super-secret-value"))
    assert all("super-secret-value" not in caller for caller, _ in rate_limit._hits)


def test_the_public_uptime_check_is_never_throttled(monkeypatch):
    monkeypatch.setattr(rate_limit, "DEFAULT_LIMIT", 1)
    assert [check_rate_limit(fake_request("/")) for _ in range(5)] == [None] * 5


def test_expired_callers_are_pruned_so_the_table_stays_bounded(monkeypatch):
    monkeypatch.setattr(rate_limit, "MAX_TRACKED_CALLERS", 3)
    for i in range(3):
        check_rate_limit(fake_request(key=f"app-{i}"), now=100.0)
    assert len(rate_limit._hits) == 3

    # a new caller after the old windows expired clears them out
    check_rate_limit(fake_request(key="app-later"), now=100.0 + rate_limit.WINDOW_SECONDS + 1)
    assert len(rate_limit._hits) == 1


def test_a_throttled_request_gets_429_with_the_header(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    # /rates with the same currency both sides answers without touching a provider
    monkeypatch.setitem(rate_limit.ROUTE_LIMITS, "/rates", 1)
    client = TestClient(main_module.app)
    headers = {"node-secretkey": "test-secret"}

    assert client.get("/rates/ZAR/ZAR", headers=headers).status_code == 200
    response = client.get("/rates/ZAR/ZAR", headers=headers)

    assert response.status_code == 429
    assert 0 < int(response.headers["Retry-After"]) <= rate_limit.WINDOW_SECONDS
    assert "wait a minute" in response.json()["detail"]
    assert response.json()["code"] == "rate_limited" and "wait a minute" in response.json()["message"]
    # still logged and still carries the request id
    assert response.headers["X-Request-ID"]


def test_versioned_and_legacy_paths_share_one_budget():
    assert rate_limit._bucket("/v1/weather/Paris") == rate_limit._bucket("/weather/Paris") == "/weather"
    assert rate_limit._bucket("/v1/destinations/enrich") == "/destinations"
