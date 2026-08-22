from fastapi import APIRouter, UploadFile, File, HTTPException

from ocr.ocr import run_ocr
from translation.live_translation import translate_text
from schemas.translation import TranslationResponse

router = APIRouter()


@router.post("/ocr", response_model=TranslationResponse)
async def ocr_and_translate(image: UploadFile = File(...)):
    try:
        image_bytes = await image.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read upload: {e}")

    try:
        text = run_ocr(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OCR error: {e}")

    result = translate_text(text)

    return TranslationResponse(
        text=text,
        detected_lang=result["detected_lang"],
        translation=result["translation"],
        message=result["message"],
    )
