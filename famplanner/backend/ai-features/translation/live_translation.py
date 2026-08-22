import os
import detectlanguage
from deep_translator import GoogleTranslator

detectlanguage.configuration.api_key = os.environ.get("detectlanguageAPIKey")

SUPPORTED_LANGUAGES = ["en", "fr", "es", "de", "it", "pt"]


def translate_text(text: str) -> dict:
    """
    Detect the language of `text` and translate to English if supported.
    Returns a dict with detected_lang, translation, and an optional message
    explaining why translation didn't happen.
    """
    if len(text) < 3:
        return {
            "detected_lang": None,
            "translation": None,
            "message": "No readable text found.",
        }

    try:
        detected_lang = detectlanguage.detect_code(text)
    except Exception as e:
        return {
            "detected_lang": None,
            "translation": None,
            "message": f"Language detection error: {e}",
        }

    if detected_lang not in SUPPORTED_LANGUAGES:
        return {
            "detected_lang": detected_lang,
            "translation": None,
            "message": f"Unsupported language: {detected_lang}",
        }

    try:
        translator = GoogleTranslator(source=detected_lang, target="en")
        translated_text = translator.translate(text)
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
