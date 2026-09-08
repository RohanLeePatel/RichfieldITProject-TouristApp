import time

import pytest

import engine.currency as currency


@pytest.fixture(autouse=True)
def _clear_rate_cache():
    """rate cache is shared module state, so clear it between tests or they'll bleed into each other"""
    currency._rate_cache.clear()
    yield
    currency._rate_cache.clear()


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


def test_successful_lookup_converts_and_caches(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    calls = []

    class _Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"result": "success", "conversion_rate": 0.055}

    def _get(url, timeout):
        calls.append(url)
        return _Response()

    monkeypatch.setattr(currency.requests, "get", _get)

    rate = currency.get_zar_conversion_rate("USD")
    assert rate == 0.055
    assert currency.convert_from_zar(1000.0, "USD") == 55.0

    # calling again within the TTL should hit the cache, not fire another request
    currency.get_zar_conversion_rate("USD")
    assert len(calls) == 1


def test_api_error_result_returns_none(monkeypatch):
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")

    class _Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"result": "error", "error-type": "unsupported-code"}

    monkeypatch.setattr(currency.requests, "get", lambda url, timeout: _Response())
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
    currency._rate_cache["USD"] = (0.05, stale_fetched_at)

    class _Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"result": "success", "conversion_rate": 0.06}

    monkeypatch.setattr(currency.requests, "get", lambda url, timeout: _Response())
    assert currency.get_zar_conversion_rate("USD") == 0.06
