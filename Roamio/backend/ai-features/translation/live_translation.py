import os

import requests

DEEPL_API_KEY = os.environ.get("deepLAPIKey")

DEEPL_API_URL = (
    "https://api-free.deepl.com/v2/translate"
    if DEEPL_API_KEY and DEEPL_API_KEY.endswith(":fx")
    else "https://api.deepl.com/v2/translate"
)

# what each DeepL failure means to the user
DEEPL_ERRORS = {
    400: "That language combination isn't supported.",
    403: "The translation service key is invalid.",
    429: "Too many translation requests - wait a moment and try again.",
    456: "The translation quota for this month has been used up.",
}

# DeepL accepts at most 50 text parameters per request, so a photo with more
# lines than that is sent in batches instead of failing outright.
DEEPL_MAX_TEXTS = 50


class TranslationError(Exception):
    pass


def deepl_source(code: str | None) -> str | None:
    """DeepL sources take no region: 'EN-US' -> 'EN', 'auto'/empty -> None (auto-detect)."""
    if not code or code.lower() == "auto":
        return None
    return code.upper().split("-")[0]


def _deepl(texts: list[str], target_lang: str, source_lang: str | None) -> list[dict]:
    """Returns DeepL's translation objects: {"text", "detected_source_language"}.
    The detected language comes back with the translation, so no separate
    language-detection provider is needed."""
    if not DEEPL_API_KEY:
        raise TranslationError("The translation service is not configured (deepLAPIKey missing).")

    translations: list[dict] = []
    for start in range(0, len(texts), DEEPL_MAX_TEXTS):
        batch = texts[start:start + DEEPL_MAX_TEXTS]
        data = [("text", t) for t in batch] + [("target_lang", target_lang)]
        if source_lang:
            data.append(("source_lang", source_lang))

        try:
            response = requests.post(
                DEEPL_API_URL,
                headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
                data=data,
                timeout=10,
            )
        except requests.Timeout:
            raise TranslationError("The translation service timed out. Try again.")
        except requests.RequestException:
            raise TranslationError("Could not reach the translation service.")

        if not response.ok:
            raise TranslationError(
                DEEPL_ERRORS.get(response.status_code, f"The translation service failed (HTTP {response.status_code}).")
            )
        translations.extend(response.json()["translations"])

    return translations


def translate_text(text: str, target_lang: str | None = None, source_lang: str | None = None) -> dict:

    target_lang = (target_lang or "EN").upper()
    source_lang = deepl_source(source_lang)
    # when the user told us the language there is nothing to detect
    given_lang = source_lang.lower() if source_lang else None

    if len(text.strip()) < 3:
        return {
            "detected_lang": None,
            "translation": None,
            "message": "No readable text found. Try a closer, sharper photo with the text filling the frame.",
        }

    try:
        translated = _deepl([text], target_lang, source_lang)[0]
    except TranslationError as e:
        return {"detected_lang": given_lang, "translation": None, "message": str(e)}

    detected = translated.get("detected_source_language")
    return {
        "detected_lang": given_lang or (detected.lower() if detected else None),
        "translation": translated["text"],
        "message": None,
    }


def translate_lines(lines: list[dict], target_lang: str | None, source_lang: str | None = None) -> list[dict]:
    """Translate each OCR line (one DeepL call per 50 lines) so it can be drawn
    back over the photo. Best-effort: on any failure the overlay is just left out."""
    if not lines:
        return []
    try:
        translated = _deepl([line["text"] for line in lines], (target_lang or "EN").upper(), deepl_source(source_lang))
    except TranslationError:
        return []
    return [{**line, "translation": t["text"]} for line, t in zip(lines, translated)]
