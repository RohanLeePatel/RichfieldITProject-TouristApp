import os

import requests

OCR_SPACE_API_KEY = os.environ.get("ocrSpaceAPIKey")
OCR_SPACE_URL = "https://api.ocr.space/parse/image"


class OcrError(Exception):
    """Carries an HTTP status and a message that is safe to show the user."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _lines(parsed: dict) -> list[dict]:
    """OCR.space overlay -> [{text, left, top, width, height}] in image pixels."""
    out = []
    for line in (parsed.get("TextOverlay") or {}).get("Lines") or []:
        words = line.get("Words") or []
        text = (line.get("LineText") or "").strip()
        if not words or not text:
            continue
        left = min(w["Left"] for w in words)
        right = max(w["Left"] + w["Width"] for w in words)
        out.append({
            "text": text,
            "left": left,
            "top": line.get("MinTop", min(w["Top"] for w in words)),
            "width": right - left,
            "height": line.get("MaxHeight") or max(w["Height"] for w in words),
        })
    return out


def run_ocr(image_bytes: bytes) -> tuple[str, list[dict]]:
    """Send image bytes to OCR.space. Returns (cleaned text, positioned lines)."""
    if not OCR_SPACE_API_KEY:
        raise OcrError(500, "Text reading is not configured (ocrSpaceAPIKey missing).")

    try:
        resp = requests.post(
            OCR_SPACE_URL,
            files={"file": ("capture.jpg", image_bytes, "image/jpeg")},
            data={
                "language": "auto",
                "OCREngine": 2,
                "scale": True,
                "isOverlayRequired": True,
            },
            headers={"apikey": OCR_SPACE_API_KEY},
            timeout=15,
        )
        resp.raise_for_status()
    except requests.Timeout:
        raise OcrError(504, "The text-reading service timed out. Try again with a smaller or clearer photo.")
    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 0
        if status == 403 or status == 429:
            raise OcrError(429, "The text-reading service is busy or its limit was reached. Try again in a minute.")
        raise OcrError(502, f"The text-reading service failed (HTTP {status}).")
    except requests.RequestException:
        raise OcrError(502, "Could not reach the text-reading service.")

    data = resp.json()

    if data.get("IsErroredOnProcessing"):
        error_msg = data.get("ErrorMessage") or ["Unknown OCR.space error"]
        raise OcrError(422, error_msg[0] if isinstance(error_msg, list) else error_msg)

    parsed_results = data.get("ParsedResults")
    if not parsed_results:
        return "", []

    parsed = parsed_results[0]
    text = " ".join(parsed.get("ParsedText", "").split())
    return text, _lines(parsed)
