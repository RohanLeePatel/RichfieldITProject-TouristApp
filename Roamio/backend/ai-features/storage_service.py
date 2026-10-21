"""Supabase Storage + client helpers for translation history.

Nothing here runs at import time: the client is built on first use so the
service still boots (and the rest of the API still works) without Supabase."""

import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("roamio.storage")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

_client = None


class StorageError(Exception):
    pass


def bucket_name() -> str:
    return os.environ.get("TRANSLATION_BUCKET_NAME") or "translation-images"


def get_client():
    """Shared Supabase client, or StorageError when it isn't configured."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise StorageError("Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
        from supabase import create_client

        _client = create_client(url, key)
    return _client


def _safe_segment(value: str | None) -> str:
    # user ids come from a header; keep them from adding path segments
    cleaned = "".join(c for c in (value or "") if c.isalnum() or c in "-_")
    return cleaned or "anonymous"


def upload_translation_image(file_bytes: bytes, content_type: str, user_id: str | None) -> str:
    """Uploads the photo and returns its public URL. Raises StorageError."""
    content_type = (content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_TYPES.get(content_type)
    if ext is None:
        raise StorageError("Only JPEG, PNG or WEBP images can be stored.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise StorageError("Image is larger than 10 MB.")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    path = f"{_safe_segment(user_id)}/{stamp}_{uuid.uuid4().hex}.{ext}"

    try:
        bucket = get_client().storage.from_(bucket_name())
        bucket.upload(path, file_bytes, {"content-type": content_type})
        return bucket.get_public_url(path)
    except StorageError:
        raise
    except Exception as e:
        raise StorageError(f"Image upload failed: {e}") from e


def storage_path_from_url(image_url: str) -> str | None:
    marker = f"/{bucket_name()}/"
    if marker not in image_url:
        return None
    return image_url.split(marker, 1)[1].split("?", 1)[0]


def delete_translation_image(image_url: str) -> None:
    """Best-effort removal; logs instead of raising."""
    path = storage_path_from_url(image_url)
    if not path:
        return
    try:
        get_client().storage.from_(bucket_name()).remove([path])
    except Exception:
        logger.exception("could not delete stored image %s", path)
