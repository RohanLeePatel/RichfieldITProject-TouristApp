"""Who the traveller is, as vouched for by the Core API.

The Core API sends x-user-id with an HMAC of "<id>.<timestamp>" (x-user-ts, x-user-sig).
Holding the shared node-secretkey is not enough to read or delete another traveller's
history: the caller also needs the signing key. Set userSigningKey to a value only the
Core API and this service know; until it is set the shared key is used, which keeps
things working but adds no protection."""

import hashlib
import hmac
import time

from fastapi import Header

from config import settings

MAX_AGE_SECONDS = 300


def _key() -> bytes | None:
    key = settings.get("userSigningKey") or settings.get("superSecretKey")
    return key.encode() if key else None


def sign(user_id: str, ts: str) -> str:
    return hmac.new(_key() or b"", f"{user_id}.{ts}".encode(), hashlib.sha256).hexdigest()


def signed_user_id(
    x_user_id: str | None = Header(None),
    x_user_ts: str | None = Header(None),
    x_user_sig: str | None = Header(None),
) -> str | None:
    """The user id if its signature is valid and fresh, else None (treated as anonymous)."""
    if not (x_user_id and x_user_ts and x_user_sig and _key()):
        return None
    try:
        fresh = abs(time.time() - int(x_user_ts)) <= MAX_AGE_SECONDS
    except ValueError:
        return None
    if not fresh or not hmac.compare_digest(sign(x_user_id, x_user_ts), x_user_sig):
        return None
    return x_user_id
