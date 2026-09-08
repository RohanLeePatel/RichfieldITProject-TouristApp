"""
Handles converting the ZAR cost bands into whatever currency the user set.

engine/weights.py's COST_BAND_ZAR_RANGE is all in ZAR, but prefs.budget_per_day
can be in any currency, so this needs to convert before comparing them.

If the conversion fails for whatever reason (no API key, request failed) it
returns None and lets the caller decide what to do - same pattern as the rest
of the engine, missing data shouldn't get treated as a red flag.

Rates get cached in memory for a day. Without caching, one recommendation
request would hit the API once per candidate, and the free tier is only
1500 requests/month.
"""

from __future__ import annotations

import os

import requests

from cache_utils import ttl_cache_get, ttl_cache_set

EXCHANGE_RATE_API_KEY = os.environ.get("exchangeRateAPIKey")
EXCHANGE_RATE_PAIR_URL = "https://v6.exchangerate-api.com/v6/{key}/pair/ZAR/{target}"
CACHE_TTL_SECONDS = 24 * 60 * 60  # rates don't need to be up to the second for a travel budget guess
REQUEST_TIMEOUT_SECONDS = 5

# currency -> (rate, fetched_at_monotonic). shared across all requests on purpose,
# not reset per-request
_rate_cache: dict[str, tuple[float, float]] = {}


def get_zar_conversion_rate(target_currency: str) -> float | None:
    """Returns how many units of `target_currency` equal 1 ZAR, or None if unavailable."""
    target_currency = target_currency.upper()
    if target_currency == "ZAR":
        return 1.0

    cached = ttl_cache_get(_rate_cache, target_currency, CACHE_TTL_SECONDS)
    if cached is not None:
        return cached

    if not EXCHANGE_RATE_API_KEY:
        return None

    try:
        response = requests.get(
            EXCHANGE_RATE_PAIR_URL.format(key=EXCHANGE_RATE_API_KEY, target=target_currency),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        if data.get("result") != "success":
            return None
        rate = float(data["conversion_rate"])
    except Exception:
        return None

    ttl_cache_set(_rate_cache, target_currency, rate)
    return rate


def convert_from_zar(amount_zar: float, target_currency: str) -> float | None:
    """Converts a ZAR amount into `target_currency`, or None if the rate is unavailable."""
    rate = get_zar_conversion_rate(target_currency)
    if rate is None:
        return None
    return amount_zar * rate
