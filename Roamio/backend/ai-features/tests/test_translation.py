from types import SimpleNamespace

import translation.live_translation as lt
from ocr.ocr import _lines
from routers.translation_router import looks_like_image


def test_image_magic_bytes():
    assert looks_like_image(b"\xff\xd8\xff\xe0rest")
    assert looks_like_image(b"\x89PNG\r\n")
    assert looks_like_image(b"RIFF\x00\x00\x00\x00WEBPVP8 ")
    assert not looks_like_image(b"%PDF-1.4")
    assert not looks_like_image(b"")


def test_deepl_source_strips_region_and_auto():
    assert lt.deepl_source("EN-US") == "EN"
    assert lt.deepl_source("pt-br") == "PT"
    assert lt.deepl_source("auto") is None
    assert lt.deepl_source(None) is None


def test_ocr_lines_box_from_words():
    parsed = {"TextOverlay": {"Lines": [
        {"LineText": "Hola", "MinTop": 10, "MaxHeight": 20,
         "Words": [{"Left": 5, "Top": 10, "Width": 30, "Height": 20},
                   {"Left": 40, "Top": 12, "Width": 25, "Height": 18}]},
        {"LineText": "", "Words": []},
    ]}}
    assert _lines(parsed) == [{"text": "Hola", "left": 5, "top": 10, "width": 60, "height": 20}]


def test_deepl_failures_become_friendly_messages(monkeypatch):
    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(lt.requests, "post", lambda *a, **k: SimpleNamespace(ok=False, status_code=456))
    result = lt.translate_text("Bonjour tout le monde", "EN-US")
    assert result["translation"] is None and "quota" in result["message"]


def test_source_language_skips_detection_and_is_sent(monkeypatch):
    sent = {}

    def fake_post(url, headers, data, timeout):
        sent["data"] = data
        return SimpleNamespace(ok=True, json=lambda: {"translations": [{"text": "Hello"}]})

    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(lt.requests, "post", fake_post)
    result = lt.translate_text("Bonjour", "EN-US", "FR")
    assert result["translation"] == "Hello" and result["detected_lang"] == "fr"
    assert ("source_lang", "FR") in sent["data"]


def test_short_text_is_no_text_found():
    assert "No readable text" in lt.translate_text("  ", "EN")["message"]
