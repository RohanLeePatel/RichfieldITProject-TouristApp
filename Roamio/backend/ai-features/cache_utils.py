"""Tiny shared helper for the in-process TTL caches used by engine/currency.py,
landmarks/landmarks.py and weather/weather.py - not worth a real caching library
for three dicts.

`allow_stale` exists so a provider failure can still answer from an expired
entry (NFR-13: serve the last cached value with a "last updated" label instead
of an error).
"""

from __future__ import annotations

import time


def ttl_cache_get(cache: dict, key, ttl_seconds: float, allow_stale: bool = False):
    cached = cache.get(key)
    if cached is None:
        return None
    value, fetched_at = cached
    if not allow_stale and time.monotonic() - fetched_at >= ttl_seconds:
        return None
    return value


def ttl_cache_set(cache: dict, key, value) -> None:
    cache[key] = (value, time.monotonic())
