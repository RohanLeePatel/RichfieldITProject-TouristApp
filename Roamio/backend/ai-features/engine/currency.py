"""
Currency conversion for budget matching.

engine/weights.py's COST_BAND_ZAR_RANGE is denominated in ZAR (see that
module's docstring for why). Preferences.currency lets a user state their
budget_per_day in any ISO 4217 currency, so before a ZAR-denominated band
can be compared against it, the band needs converting into that same
currency via ExchangeRate-API.

Same discipline as the rest of the engine (see engine/gates.py,
engine/scorers.py): an unavailable conversion reads as "unknown", never as
a reason to wrongly gate a candidate in or out. Callers get None back and
decide how to fail — always open, not closed, consistent with "no cost
data — don't punish for missing enrichment".

Rates are cached in-process for CACHE_TTL_SECONDS. One recommendation
request scores every candidate's budget dimension plus the budget gate, all
against the same prefs.currency — without caching that's one HTTP call per
candidate, and ExchangeRate-API's free tier is a shared 1500 requests/month.
"""

from __future__ import annotations

import os
import time

import requests

EXCHANGE_RATE_API_KEY = os.environ.get("exchangeRateAPIKey")
EXCHANGE_RATE_PAIR_URL = "https://v6.exchangerate-api.com/v6/{key}/pair/ZAR/{target}"
CACHE_TTL_SECONDS = 24 * 60 * 60  # exchange rates don't need to be live-to-the-second for a travel budget estimate
REQUEST_TIMEOUT_SECONDS = 5

# currency -> (rate, fetched_at_monotonic). Module-level: deliberately
# shared across requests within one process, not per-request state.
_rate_cache: dict[str, tuple[float, float]] = {}


def get_zar_conversion_rate(target_currency: str) -> float | None:
    """Returns how many units of `target_currency` equal 1 ZAR, or None if unavailable."""
    target_currency = target_currency.upper()
    if target_currency == "ZAR":
        return 1.0

    cached = _rate_cache.get(target_currency)
    if cached is not None:
        rate, fetched_at = cached
        if time.monotonic() - fetched_at < CACHE_TTL_SECONDS:
            return rate

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

    _rate_cache[target_currency] = (rate, time.monotonic())
    return rate


def convert_from_zar(amount_zar: float, target_currency: str) -> float | None:
    """Converts a ZAR amount into `target_currency`, or None if the rate is unavailable."""
    rate = get_zar_conversion_rate(target_currency)
    if rate is None:
        return None
    return amount_zar * rate
