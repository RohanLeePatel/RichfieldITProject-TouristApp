"""
The one way this service calls a provider (weather, geocoding, translation...).

Before this, each module chose its own timeout and decided for itself whether to
try again. Now every call gets a timeout, one retry when the network or the
provider's server fails (not when the answer is a clear "no", such as a bad key),
and a way to describe a failure without printing the request URL, which for
Geoapify and others carries the API key.

Callers keep their own handling of the response (raise_for_status, fallbacks to
cached data), so what a failure means stays with the feature that knows.

Known limit: retries are a single attempt after a short pause, with no backoff and no
circuit breaker. If a provider goes down often enough that waiting on it hurts,
add those here, in one place.
"""

from __future__ import annotations

import time

import requests

DEFAULT_TIMEOUT_SECONDS = 10
RETRY_PAUSE_SECONDS = 0.25

# requests raises these when the provider could not be reached at all
_RETRYABLE_ERRORS = (requests.ConnectionError, requests.Timeout)


def _call(method: str, url: str, retries: int, **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", DEFAULT_TIMEOUT_SECONDS)
    attempts = retries + 1
    for attempt in range(1, attempts + 1):
        last = attempt == attempts
        try:
            # looked up by name each time so tests can replace requests.get / requests.post
            response = getattr(requests, method)(url, **kwargs)
        except _RETRYABLE_ERRORS:
            if last:
                raise
        else:
            if getattr(response, "status_code", 200) < 500 or last:
                return response
        time.sleep(RETRY_PAUSE_SECONDS)
    raise AssertionError("unreachable")  # the loop always returns or raises on its last attempt


def get(url: str, *, retries: int = 1, **kwargs) -> requests.Response:
    return _call("get", url, retries, **kwargs)


def post(url: str, *, retries: int = 1, **kwargs) -> requests.Response:
    return _call("post", url, retries, **kwargs)


def describe_error(error: BaseException) -> str:
    """A failure in words that are safe to log: its kind, never its message (which can hold the URL and key)."""
    return type(error).__name__
