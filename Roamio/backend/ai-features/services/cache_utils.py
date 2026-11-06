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


# A cap so a long-running instance can't grow a cache without bound: one entry
# per city, currency pair or place lookup, and nothing evicts on its own. When the
# cap is reached, the oldest entry is dropped. Finding it is a linear scan, which is
# fine at this size. If the caches ever hold thousands of entries, switch to an
# OrderedDict.
MAX_ENTRIES = 512


def ttl_cache_set(cache: dict, key, value, max_entries: int = MAX_ENTRIES) -> None:
    if key not in cache and len(cache) >= max_entries:
        del cache[min(cache, key=lambda k: cache[k][1])]
    cache[key] = (value, time.monotonic())
