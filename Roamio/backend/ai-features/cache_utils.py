"""Tiny shared helper for the in-process TTL caches used by engine/currency.py
and landmarks/landmarks.py - not worth a real caching library for two dicts."""

from __future__ import annotations

import time


def ttl_cache_get(cache: dict, key, ttl_seconds: float):
    cached = cache.get(key)
    if cached is None:
        return None
    value, fetched_at = cached
    if time.monotonic() - fetched_at >= ttl_seconds:
        return None
    return value


def ttl_cache_set(cache: dict, key, value) -> None:
    cache[key] = (value, time.monotonic())
