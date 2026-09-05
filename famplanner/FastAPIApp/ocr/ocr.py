import os
import requests

OCR_SPACE_API_KEY = os.environ.get("ocrSpaceAPIKey")
OCR_SPACE_URL = "https://api.ocr.space/parse/image"


def run_ocr(image_bytes: bytes) -> str:
    """Send image bytes to OCR.space, return cleaned extracted text."""
    resp = requests.post(
        OCR_SPACE_URL,
        files={"file": ("capture.jpg", image_bytes, "image/jpeg")},
        data={
            "language": "auto",
            "OCREngine": 2,
            "scale": True,
            "isOverlayRequired": False,
        },
        headers={"apikey": OCR_SPACE_API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("IsErroredOnProcessing"):
        error_msg = data.get("ErrorMessage") or ["Unknown OCR.space error"]
        raise RuntimeError(
            error_msg[0] if isinstance(error_msg, list) else error_msg
        )

    parsed_results = data.get("ParsedResults")
    if not parsed_results:
        return ""

    text = parsed_results[0].get("ParsedText", "").strip()
    return " ".join(text.split())
