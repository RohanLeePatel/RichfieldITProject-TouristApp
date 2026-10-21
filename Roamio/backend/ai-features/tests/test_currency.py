import time

import pytest

import engine.currency as currency


@pytest.fixture(autouse=True)
def _clear_rate_cache():
    """rate cache is shared module state, so clear it between tests or they'll bleed into each other"""
    currency._rate_cache.clear()
    yield
    currency._rate_cache.clear()


class _Response:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _ok(rate=0.055):
    return lambda url, timeout: _Response({"result": "success", "conversion_rate": rate})


def test_zar_short_circuits_without_a_network_call(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "unused")

    def _fail(*args, **kwargs):
        raise AssertionError("should not call the network for ZAR")

    monkeypatch.setattr(currency.requests, "get", _fail)
    assert currency.get_zar_conversion_rate("zar") == 1.0


def test_no_api_key_returns_none(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", None)
    assert currency.get_zar_conversion_rate("USD") is None
    assert currency.convert_from_zar(1000.0, "USD") is None
    assert currency.rate_detail("ZAR", "USD") is None


def test_successful_lookup_converts_and_caches(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    calls = []

    def _get(url, timeout):
        calls.append(url)
        return _Response({"result": "success", "conversion_rate": 0.055})

    monkeypatch.setattr(currency.requests, "get", _get)

    rate = currency.get_zar_conversion_rate("USD")
    assert rate == 0.055
    assert currency.convert_from_zar(1000.0, "USD") == 55.0

    # calling again within the TTL should hit the cache, not fire another request
    currency.get_zar_conversion_rate("USD")
    assert len(calls) == 1


def test_api_error_result_returns_none(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    monkeypatch.setattr(
        currency.requests,
        "get",
        lambda url, timeout: _Response({"result": "error", "error-type": "unsupported-code"}),
    )
    assert currency.get_zar_conversion_rate("XXX") is None


def test_network_failure_returns_none(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")

    def _raise(url, timeout):
        raise currency.requests.exceptions.ConnectionError("boom")

    monkeypatch.setattr(currency.requests, "get", _raise)
    assert currency.get_zar_conversion_rate("USD") is None


def test_expired_cache_entry_triggers_a_refetch(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    # fetched_at must be relative to time.monotonic() (counts from boot, not
    # a fixed epoch) — an absolute 0.0 only reads as "expired" on a machine
    # that's been up longer than CACHE_TTL_SECONDS, which is not guaranteed.
    stale_fetched_at = time.monotonic() - currency.CACHE_TTL_SECONDS - 1
    currency._rate_cache[("ZAR", "USD")] = ((0.05, "2026-10-01T00:00:00+00:00"), stale_fetched_at)

    monkeypatch.setattr(currency.requests, "get", _ok(0.06))
    assert currency.get_zar_conversion_rate("USD") == 0.06


def test_any_pair_is_requested_and_cached_separately(monkeypatch):
    """FR-13: an expense can be in any currency, not only ZAR."""
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    urls = []

    def _get(url, timeout):
        urls.append(url)
        return _Response({"result": "success", "conversion_rate": 1.2})

    monkeypatch.setattr(currency.requests, "get", _get)

    assert currency.get_rate("eur", "gbp") == 1.2
    assert ("EUR", "GBP") in currency._rate_cache
    assert "/pair/EUR/GBP" in urls[0]


def test_same_currency_needs_no_rate():
    detail = currency.rate_detail("usd", "USD")
    assert detail == {"base": "USD", "target": "USD", "rate": 1.0, "fetched_at": None, "stale": False}


def test_detail_reports_when_the_rate_was_fetched(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    monkeypatch.setattr(currency.requests, "get", _ok())

    detail = currency.rate_detail("ZAR", "USD")
    assert detail["rate"] == 0.055 and detail["stale"] is False
    assert detail["fetched_at"].endswith("+00:00")


def test_provider_failure_serves_the_expired_rate_as_stale(monkeypatch):
    """NFR-13: the last cached rate with a "last updated" label beats no answer."""
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    stale_fetched_at = time.monotonic() - currency.CACHE_TTL_SECONDS - 1
    currency._rate_cache[("ZAR", "USD")] = ((0.05, "2026-10-01T00:00:00+00:00"), stale_fetched_at)

    def _raise(url, timeout):
        raise currency.requests.exceptions.ConnectionError("boom")

    monkeypatch.setattr(currency.requests, "get", _raise)

    detail = currency.rate_detail("ZAR", "USD")
    assert detail == {
        "base": "ZAR",
        "target": "USD",
        "rate": 0.05,
        "fetched_at": "2026-10-01T00:00:00+00:00",
        "stale": True,
    }
