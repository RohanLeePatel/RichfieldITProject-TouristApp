"""translation_history persistence (Supabase PostgREST). Writes are best-effort
for the callers: save_* return None and log on failure."""

import logging

from storage_service import StorageError, get_client

logger = logging.getLogger("roamio.history")

TABLE = "translation_history"
TYPES = ("TEXT", "IMAGE_CAMERA")
PHOTO_LIMIT = 15  # per traveller; keeps the free Supabase storage tier small


def save_record(record: dict) -> str | None:
    """Inserts a row and returns its id, or None if it could not be saved."""
    try:
        rows = get_client().table(TABLE).insert(record).execute().data
        return rows[0]["id"] if rows else None
    except Exception:
        logger.exception("could not save translation history")
        return None


def list_records(user_id: str, limit: int, offset: int, type_: str | None) -> dict:
    query = get_client().table(TABLE).select("*", count="exact").eq("user_id", user_id)
    if type_:
        query = query.eq("translation_type", type_)
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return {"items": result.data, "total": result.count, "limit": limit, "offset": offset}


def delete_record(user_id: str, record_id: str) -> dict | None:
    """Deletes the row if it belongs to user_id; returns it, or None when not found/not theirs."""
    rows = get_client().table(TABLE).delete().eq("id", record_id).eq("user_id", user_id).execute().data
    return rows[0] if rows else None


def prune_photos(user_id: str) -> list[str]:
    """Deletes the user's photo rows past the newest PHOTO_LIMIT and returns
    their image URLs, so the caller can remove the files too."""
    rows = (
        get_client().table(TABLE).select("id,image_url").eq("user_id", user_id)
        .eq("translation_type", "IMAGE_CAMERA").order("created_at", desc=True)
        .range(PHOTO_LIMIT, PHOTO_LIMIT + 99).execute().data
    )
    if not rows:
        return []
    get_client().table(TABLE).delete().in_("id", [r["id"] for r in rows]).eq("user_id", user_id).execute()
    return [r["image_url"] for r in rows if r.get("image_url")]


__all__ = ["StorageError", "save_record", "list_records", "delete_record", "prune_photos", "PHOTO_LIMIT", "TYPES"]
