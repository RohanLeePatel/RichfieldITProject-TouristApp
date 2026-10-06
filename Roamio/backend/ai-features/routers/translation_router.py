from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from ocr.ocr import run_ocr, OcrError
from translation.live_translation import translate_text, translate_lines
from schemas.translation import TranslationResponse, TextRequest
from config.auth import verify_secretKey

router = APIRouter()

MAX_IMAGE_BYTES = 5 * 1024 * 1024
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
        image_bytes = image.file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read upload: {e}")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="That photo is too large (5 MB max).")
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
