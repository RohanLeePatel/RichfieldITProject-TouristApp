"""
Exchange rates, used for two things:

1. the engine converts the ZAR cost bands in engine/weights.py into whatever
   currency the traveller set, because prefs.budget_per_day can be in any
   currency and the two have to be compared in the same one;
2. /rates/{base}/{target} answers the Core API when an expense is recorded in a
   currency other than the trip currency (FR-13), which stores the rate with the
   expense.

If a lookup fails for whatever reason (no API key, request failed) it returns
None and lets the caller decide what to do - same pattern as the rest of the
engine, missing data shouldn't get treated as a red flag.

Rates get cached in memory for a day. Without caching, one recommendation
request would hit the API once per candidate, and the provider (fastFOREX)
meters requests. An expired entry is still served when the provider is
failing, flagged as stale (NFR-13).
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import requests

from cache_utils import ttl_cache_get, ttl_cache_set

logger = logging.getLogger(__name__)

EXCHANGE_RATE_API_KEY = os.environ.get("exchangeRateAPIKey")
EXCHANGE_RATE_PAIR_URL = "https://api.fastforex.io/fetch-one?from={base}&to={target}&api_key={key}"
CACHE_TTL_SECONDS = 24 * 60 * 60  # rates don't need to be up to the second for a travel budget guess
REQUEST_TIMEOUT_SECONDS = 5

# (base, target) -> ((rate, fetched_at_iso), fetched_at_monotonic). shared across
# all requests on purpose, not reset per-request
_rate_cache: dict[tuple[str, str], tuple[tuple[float, str], float]] = {}


def _detail(base: str, target: str, rate: float, fetched_at: str | None, stale: bool) -> dict:
    return {"base": base, "target": target, "rate": rate, "fetched_at": fetched_at, "stale": stale}


def _stale_or_none(base: str, target: str) -> dict | None:
    cached = ttl_cache_get(_rate_cache, (base, target), CACHE_TTL_SECONDS, allow_stale=True)
    if cached is None:
        return None
    rate, fetched_at = cached
    return _detail(base, target, rate, fetched_at, stale=True)


def rate_detail(base: str, target: str) -> dict | None:
    """One unit of `base` in `target`, with when it was fetched, or None if unavailable."""
    base, target = base.upper(), target.upper()
    if base == target:
        return _detail(base, target, 1.0, None, stale=False)

    cached = ttl_cache_get(_rate_cache, (base, target), CACHE_TTL_SECONDS)
    if cached is not None:
        rate, fetched_at = cached
        return _detail(base, target, rate, fetched_at, stale=False)

    if not EXCHANGE_RATE_API_KEY:
        return _stale_or_none(base, target)

    try:
        response = requests.get(
            EXCHANGE_RATE_PAIR_URL.format(key=EXCHANGE_RATE_API_KEY, base=base, target=target),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        # {"base": "USD", "result": {"ZAR": 18.2}, ...}, or {"error": "..."}
        # with a 4xx - read the body either way so the reason gets logged
        data = response.json()
        rate = (data.get("result") or {}).get(target)
        if rate is None:
            logger.warning("fastFOREX refused %s->%s: %s", base, target, data.get("error"))
            return _stale_or_none(base, target)
        rate = float(rate)
    except Exception as e:
        # the URL carries the API key, so log the exception type only
        logger.warning("fastFOREX request failed: %s", type(e).__name__)
        return _stale_or_none(base, target)

    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ttl_cache_set(_rate_cache, (base, target), (rate, fetched_at))
    return _detail(base, target, rate, fetched_at, stale=False)


def get_rate(base: str, target: str) -> float | None:
    """Rate only, for callers that don't care when it was fetched."""
    detail = rate_detail(base, target)
    return detail["rate"] if detail else None


def get_zar_conversion_rate(target_currency: str) -> float | None:
    """Returns how many units of `target_currency` equal 1 ZAR, or None if unavailable."""
    return get_rate("ZAR", target_currency)


def convert_from_zar(amount_zar: float, target_currency: str) -> float | None:
    """Converts a ZAR amount into `target_currency`, or None if the rate is unavailable."""
    rate = get_zar_conversion_rate(target_currency)
    if rate is None:
        return None
    return amount_zar * rate
