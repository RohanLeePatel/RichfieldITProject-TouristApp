"""Per-caller rate limiting for the whole service (NFR-30).

The Core API already limits per traveller IP. This is the backstop one level
down: it protects the shared free-tier provider quotas from any single caller,
including one that reaches the public URL directly, and it is what keeps a
second application honest once more than one app uses this API.

A caller is identified by its service key, not its IP, because every request
from the Core API arrives from the same handful of addresses. Each key gets its
own budget, so adding an app later means issuing it a key, not re-tuning this.
Requests with no key are grouped by client address instead, which is all the
spam that never gets past verify_secretKey.

Fixed window, in process - same shape as the Core API's limiter.

Limits: counts live in this process, so each serverless instance keeps its own
count and the effective limit grows with the number of instances. If a strict
global cap ever matters, move the counts to a shared store such as Redis.
"""

from __future__ import annotations

import hashlib
import time

from fastapi import Request

WINDOW_SECONDS = 60

# The default is deliberately well above the Core API's per-traveller limits,
# because this service sees every traveller's traffic combined. Routes that
# spend shared provider quota get a tighter budget than the arithmetic ones.
DEFAULT_LIMIT = 600
ROUTE_LIMITS: dict[str, int] = {
    "/ocr": 120,            # OCR.space free tier: 25 000 requests a month
    "/text": 120,           # DeepL free tier: 500 000 characters a month
    "/api/translate": 120,  # the routes the Core API really calls (text, camera, history): same DeepL/OCR quotas
    "/places": 120,         # same Geoapify quota as /landmarks
    "/landmarks": 120,      # Geoapify free tier: 3 000 requests a day
    "/weather": 300,        # OpenWeather free tier: 60 calls a minute
    "/recommendations": 300,
    "/destinations": 20,    # each call is ~20 Geoapify requests; admin-only, so rarely used
    "/chat": 60,            # Gemini free tier: low per-minute and daily request quota
}

# the public uptime check must answer even while a caller is being throttled
EXEMPT_PATHS = {"/"}

# a caller that stops calling is forgotten once its window expires; this only
# bounds the dictionary if a flood of distinct callers arrives at once
MAX_TRACKED_CALLERS = 5000

# (caller, path bucket) -> (count, window_reset_at_monotonic)
_hits: dict[tuple[str, str], tuple[int, float]] = {}


def _bucket(path: str) -> str:
    """The longest configured prefix the path falls under, else "" for the default."""
    path = path.removeprefix("/v1")  # versioned and legacy paths share one budget
    for prefix in ROUTE_LIMITS:
        if path == prefix or path.startswith(prefix + "/"):
            return prefix
    return ""


def _caller(request: Request) -> str:
    key = request.headers.get("node-secretkey")
    if key:
        # the key identifies the calling application; hash it so the raw secret
        # is not held in a long-lived dictionary
        return "key:" + hashlib.sha256(key.encode()).hexdigest()[:12]
    # X-Forwarded-For is set by the client, so a caller that reaches this service
    # directly can change its apparent address. This grouping only deters casual
    # spam. Real protection comes from the service key.
    forwarded = request.headers.get("x-forwarded-for", "")
    client_host = request.client.host if request.client else "unknown"
    return "ip:" + (forwarded.split(",")[0].strip() or client_host)


def _prune(now: float) -> None:
    for key in [k for k, (_, reset_at) in _hits.items() if now >= reset_at]:
        del _hits[key]


def check_rate_limit(request: Request, now: float | None = None) -> int | None:
    """Count this request. Returns the Retry-After seconds when it is over the
    limit, or None when it may proceed."""
    path = request.url.path
    if path in EXEMPT_PATHS:
        return None

    now = time.monotonic() if now is None else now
    bucket = _bucket(path)
    limit = ROUTE_LIMITS.get(bucket, DEFAULT_LIMIT)
    entry_key = (_caller(request), bucket)

    count, reset_at = _hits.get(entry_key, (0, 0.0))
    if now >= reset_at:
        count, reset_at = 0, now + WINDOW_SECONDS
        if len(_hits) >= MAX_TRACKED_CALLERS:
            _prune(now)

    count += 1
    _hits[entry_key] = (count, reset_at)

    if count > limit:
        return max(1, round(reset_at - now))
    return None
