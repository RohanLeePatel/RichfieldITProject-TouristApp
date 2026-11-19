from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from config.auth import verify_secretKey
from ocr.ocr import OcrError, run_ocr
from schemas.translation import TextRequest, TranslationResponse
from translation.live_translation import translate_lines, translate_text

router = APIRouter()

# OCR.space's free tier rejects anything over 1 MB, and the frontend already
# compresses to that (utils/translatorHelpers.js compressImage). Enforcing the
# same number here means an oversized photo gets our message instead of the
# provider's "File size exceeded".
MAX_IMAGE_BYTES = 1024 * 1024
# leading bytes of JPEG, PNG, GIF, WEBP ("RIFF....WEBP") - the client's content-type isn't trusted
IMAGE_MAGIC = (b"\xff\xd8\xff", b"\x89PNG", b"GIF8")


def looks_like_image(data: bytes) -> bool:
    return data.startswith(IMAGE_MAGIC) or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")


@router.post("/ocr", response_model=TranslationResponse, dependencies=[Depends(verify_secretKey)])
def ocr_and_translate(
    image: UploadFile = File(...),
    target_lang: str | None = Form(None),
    source_lang: str | None = Form(None),
):
    try:
        # .file.read() rather than await .read(): the handler is sync so FastAPI
        # runs it in the threadpool, which keeps a slow OCR call off the event loop
        image_bytes = image.file.read(MAX_IMAGE_BYTES + 1)
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

    return TranslationResponse(
        text=text,
        detected_lang=result["detected_lang"],
        translation=result["translation"],
        message=result["message"],
        lines=translate_lines(lines, target_lang, source_lang) if result["translation"] else [],
    )


@router.post("/text", response_model=TranslationResponse, dependencies=[Depends(verify_secretKey)])
def translate_typed_text(body: TextRequest):
    result = translate_text(body.text, body.target_lang, body.source_lang)
    return TranslationResponse(
        text=body.text,
        detected_lang=result["detected_lang"],
        translation=result["translation"],
        message=result["message"],
    )
