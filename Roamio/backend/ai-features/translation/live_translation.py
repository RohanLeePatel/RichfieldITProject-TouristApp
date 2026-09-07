import os
import detectlanguage
import requests

detectlanguage.configuration.api_key = os.environ.get("detectlanguageAPIKey")

DEEPL_API_KEY = os.environ.get("deepLAPIKey")

DEEPL_API_URL = (
    "https://api-free.deepl.com/v2/translate"
    if DEEPL_API_KEY and DEEPL_API_KEY.endswith(":fx")
    else "https://api.deepl.com/v2/translate"
)


def translate_text(text: str, target_lang: str | None = None) -> dict:

    target_lang = (target_lang or "EN").upper()

    if len(text) < 3:
        return {
            "detected_lang": None,
            "translation": None,
            "message": "No readable text found.",
        }

    detected_lang = None
    try:
        detected_lang = detectlanguage.detect_code(text)
    except Exception:
        pass

    if not DEEPL_API_KEY:
        return {
            "detected_lang": detected_lang,
            "translation": None,
            "message": "Translation error: deepLAPIKey is not configured.",
        }

    try:
        response = requests.post(
            DEEPL_API_URL,
            headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
            data={"text": text, "target_lang": target_lang},
            timeout=10,
        )
        response.raise_for_status()
        translated_text = response.json()["translations"][0]["text"]
    except Exception as e:
        return {
            "detected_lang": detected_lang,
            "translation": None,
            "message": f"Translation error: {e}",
        }

    return {
        "detected_lang": detected_lang,
        "translation": translated_text,
        "message": None,
    }
