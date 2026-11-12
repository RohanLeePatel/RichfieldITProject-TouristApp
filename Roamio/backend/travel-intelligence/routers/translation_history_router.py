import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from config.auth import verify_secretKey
from config.user_assertion import signed_user_id
from ocr.ocr import OcrError, run_ocr
from routers.translation_router import MAX_IMAGE_BYTES, looks_like_image
from services import history_service, storage_service
from translation.live_translation import deepl_source, translate_lines, translate_text

logger = logging.getLogger("roamio.history")

router = APIRouter(prefix="/api/translate", dependencies=[Depends(verify_secretKey)])

UUID_RE = re.compile(r"^[0-9a-fA-F-]{36}$")


def sniff_content_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _user(x_user_id: str | None) -> str | None:
    # the Core API (already authenticated by the shared secret) says who the traveller is
    return (x_user_id or "").strip() or None


def _require_user(x_user_id: str | None) -> str:
    user = _user(x_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="A signed x-user-id is required.")
    return user


def _langs(source_lang: str | None, detected: str | None) -> tuple[str, str | None]:
    src = deepl_source(source_lang)
    return (src.lower() if src else "auto"), detected


class TextBody(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    target_lang: Optional[str] = None
    source_lang: Optional[str] = None
    save_history: bool = True


@router.post("/text")
def translate_text_with_history(body: TextBody, x_user_id: str | None = Depends(signed_user_id)):
    user_id = _user(x_user_id)
    result = translate_text(body.text, body.target_lang, body.source_lang)
    response = {**result, "text": body.text, "history_id": None}

    if body.save_history and user_id and result["translation"]:
        source, detected = _langs(body.source_lang, result["detected_lang"])
        response["history_id"] = history_service.save_record({
            "user_id": user_id,
            "translation_type": "TEXT",
            "source_text": body.text,
            "translated_text": result["translation"],
            "source_lang": source,
            "detected_lang": detected,
            "target_lang": (body.target_lang or "EN").upper(),
        })
        response["history_saved"] = response["history_id"] is not None
    return response


@router.post("/camera")
def translate_camera_with_history(
    image: UploadFile = File(...),
    target_lang: str | None = Form(None),
    source_lang: str | None = Form(None),
    # text, not bool: some FastAPI versions read a missing bool form field as
    # False (unticked-checkbox rule), which silently turned history off
    save_history: str = Form("true"),
    x_user_id: str | None = Depends(signed_user_id),
):
    user_id = _user(x_user_id)
    save_history = save_history.strip().lower() not in ("false", "0", "no", "off")
    try:
        image_bytes = image.file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read the upload.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="That photo is too large (1 MB max). Try a tighter crop of just the text.",
        )
    if not looks_like_image(image_bytes):
        raise HTTPException(status_code=415, detail="That file isn't a JPG, PNG, GIF or WEBP image.")

    try:
        text, lines = run_ocr(image_bytes)
    except OcrError as e:
        raise HTTPException(status_code=e.status, detail=e.message)

    result = translate_text(text, target_lang, source_lang)
    overlay = translate_lines(lines, target_lang, source_lang) if result["translation"] else []
    response = {
        "text": text,
        "translation": result["translation"],
        "message": result["message"],
        "lines": overlay,
        "detected_lang": result["detected_lang"],
        "image_url": None,
        "history_id": None,
    }

    # Guests are not saved, same rule as /text. Without a user there is no one
    # who can list or delete the row, so a guest's photo would sit in a public
    # bucket for good.
    if save_history and user_id and result["translation"]:
        # a failure from here on must not cost the traveller their translation
        image_url = None
        content_type = sniff_content_type(image_bytes)
        if content_type:
            try:
                image_url = storage_service.upload_translation_image(image_bytes, content_type, user_id)
            except storage_service.StorageError:
                logger.exception("camera image upload failed")
        source, detected = _langs(source_lang, result["detected_lang"])
        history_id = history_service.save_record({
            "user_id": user_id,
            "translation_type": "IMAGE_CAMERA",
            "source_text": text,
            "translated_text": result["translation"],
            "ocr_data": overlay,
            "source_lang": source,
            "detected_lang": detected,
            "target_lang": (target_lang or "EN").upper(),
            "image_url": image_url,
        })
        response["image_url"] = (storage_service.signed_image_url(image_url) or image_url) if image_url else None
        response["history_id"] = history_id
        response["history_saved"] = history_id is not None
        if history_id:
            try:
                for old_url in history_service.prune_photos(user_id):
                    storage_service.delete_translation_image(old_url)
            except Exception:
                logger.exception("could not prune old photo history")
    return response


@router.get("/history")
def get_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: Optional[str] = Query(None, pattern="^(TEXT|IMAGE_CAMERA)$"),
    x_user_id: str | None = Depends(signed_user_id),
):
    user_id = _require_user(x_user_id)
    try:
        page = history_service.list_records(user_id, limit, offset, type)
        for item in page["items"]:
            if item.get("image_url"):
                item["image_url"] = storage_service.signed_image_url(item["image_url"])
        return page
    except Exception:
        logger.exception("could not read translation history")
        raise HTTPException(status_code=503, detail="Translation history is unavailable right now.")


@router.delete("/history")
def delete_all_history(x_user_id: str | None = Depends(signed_user_id)):
    """Every saved translation and stored photograph of one traveller (they deleted their account)."""
    user_id = _require_user(x_user_id)
    try:
        rows = history_service.delete_all(user_id)
    except Exception:
        logger.exception("could not delete translation history")
        raise HTTPException(status_code=503, detail="Translation history is unavailable right now.")
    for row in rows:
        if row.get("image_url"):
            storage_service.delete_translation_image(row["image_url"])
    return {"deleted": len(rows)}


@router.delete("/history/{record_id}")
def delete_history(record_id: str, x_user_id: str | None = Depends(signed_user_id)):
    user_id = _require_user(x_user_id)
    if not UUID_RE.match(record_id):
        raise HTTPException(status_code=404, detail="Not found.")
    try:
        deleted = history_service.delete_record(user_id, record_id)
    except Exception:
        logger.exception("could not delete translation history")
        raise HTTPException(status_code=503, detail="Translation history is unavailable right now.")
    if deleted is None:
        # same answer for "missing" and "someone else's" so ids can't be probed
        raise HTTPException(status_code=404, detail="Not found.")
    if deleted.get("image_url"):
        storage_service.delete_translation_image(deleted["image_url"])
    return {"deleted": True, "id": record_id}
