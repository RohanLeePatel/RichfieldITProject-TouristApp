"""The shared TTL cache helper."""

import time

from cache_utils import MAX_ENTRIES, ttl_cache_get, ttl_cache_set


def test_a_fresh_value_reads_back():
    cache = {}
    ttl_cache_set(cache, "k", "v")
    assert ttl_cache_get(cache, "k", 60) == "v"


def test_an_expired_value_reads_as_missing_unless_stale_is_allowed():
    cache = {"k": ("v", time.monotonic() - 61)}
    assert ttl_cache_get(cache, "k", 60) is None
    assert ttl_cache_get(cache, "k", 60, allow_stale=True) == "v"


def test_a_missing_key_is_none():
    assert ttl_cache_get({}, "nothing", 60) is None


def test_the_oldest_entry_is_evicted_once_the_cache_is_full():
    cache = {}
    for i in range(MAX_ENTRIES):
        ttl_cache_set(cache, i, i)
    assert len(cache) == MAX_ENTRIES

    ttl_cache_set(cache, "newcomer", "v")
    assert len(cache) == MAX_ENTRIES
    assert 0 not in cache  # the first one written went
    assert cache["newcomer"][0] == "v"


def test_updating_an_existing_key_evicts_nothing():
    cache = {}
    for i in range(MAX_ENTRIES):
        ttl_cache_set(cache, i, i)
    ttl_cache_set(cache, 0, "refreshed")
    assert len(cache) == MAX_ENTRIES
    assert cache[0][0] == "refreshed"
