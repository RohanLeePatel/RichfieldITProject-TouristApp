from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from ocr.ocr import run_ocr
from translation.live_translation import translate_text
from schemas.translation import TranslationResponse
from config.auth import verify_secretKey

router = APIRouter()


@router.post("/ocr", response_model=TranslationResponse, dependencies=[Depends(verify_secretKey)])
async def ocr_and_translate(image: UploadFile = File(...), target_lang: str | None = Form(None)):
    try:
        image_bytes = await image.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read upload: {e}")

    try:
        text = run_ocr(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR error: {e}")

    result = translate_text(text, target_lang)

    return TranslationResponse(
        text=text,
        detected_lang=result["detected_lang"],
        translation=result["translation"],
        message=result["message"],
    )
