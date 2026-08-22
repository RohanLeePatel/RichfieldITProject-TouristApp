import os
import detectlanguage
from deep_translator import GoogleTranslator

detectlanguage.configuration.api_key = os.environ.get("detectlanguageAPIKey")


def translate_text(text: str) -> dict:

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

    try:
        translated_text = GoogleTranslator(source="auto", target="en").translate(text)
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