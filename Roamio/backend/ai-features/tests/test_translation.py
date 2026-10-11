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


def test_detected_language_comes_from_the_translation_response(monkeypatch):
    """DeepL reports the source language with the translation, so no separate
    detection provider is called."""

    def fake_post(url, headers, data, timeout):
        return SimpleNamespace(
            ok=True,
            json=lambda: {"translations": [{"text": "Emergency exit", "detected_source_language": "ES"}]},
        )

    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(lt.requests, "post", fake_post)

    result = lt.translate_text("Salida de emergencia", "EN-US")
    assert result["translation"] == "Emergency exit"
    assert result["detected_lang"] == "es"
    assert result["message"] is None


def test_lines_are_sent_in_batches_of_fifty(monkeypatch):
    """DeepL accepts at most 50 texts per request, so a long sign is split."""
    batch_sizes = []

    def fake_post(url, headers, data, timeout):
        texts = [value for key, value in data if key == "text"]
        batch_sizes.append(len(texts))
        return SimpleNamespace(
            ok=True, json=lambda: {"translations": [{"text": t.upper()} for t in texts]}
        )

    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(lt.requests, "post", fake_post)

    lines = [{"text": f"line {i}", "left": 0, "top": i, "width": 1, "height": 1} for i in range(120)]
    translated = lt.translate_lines(lines, "EN")

    assert batch_sizes == [50, 50, 20]
    assert len(translated) == 120
    assert translated[0]["translation"] == "LINE 0"
    assert translated[119]["top"] == 119  # positions survive the batching


def test_source_language_skips_detection_and_is_sent(monkeypatch):
    sent = {}

    def fake_post(url, headers, data, timeout):
        sent["data"] = data
        return SimpleNamespace(
            ok=True,
            json=lambda: {"translations": [{"text": "Hello", "detected_source_language": "FR"}]},
        )

    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(lt.requests, "post", fake_post)
    result = lt.translate_text("Bonjour", "EN-US", "FR")
    assert result["translation"] == "Hello" and result["detected_lang"] == "fr"
    assert ("source_lang", "FR") in sent["data"]


def test_short_text_is_no_text_found():
    assert "No readable text" in lt.translate_text("  ", "EN")["message"]


def test_without_a_key_nothing_is_translated(monkeypatch):
    monkeypatch.setattr(lt, "DEEPL_API_KEY", None)
    result = lt.translate_text("Salida de emergencia", "EN")
    assert result["translation"] is None and "not configured" in result["message"]


def test_a_timeout_is_reported_in_plain_language(monkeypatch):
    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(
        lt.requests, "post", lambda *a, **k: (_ for _ in ()).throw(lt.requests.Timeout())
    )
    assert "timed out" in lt.translate_text("Salida de emergencia", "EN")["message"]


def test_an_unreachable_service_is_reported_in_plain_language(monkeypatch):
    monkeypatch.setattr(lt, "DEEPL_API_KEY", "k:fx")
    monkeypatch.setattr(
        lt.requests,
        "post",
        lambda *a, **k: (_ for _ in ()).throw(lt.requests.ConnectionError("down")),
    )
    assert "Could not reach" in lt.translate_text("Salida de emergencia", "EN")["message"]


def test_no_lines_means_no_call(monkeypatch):
    monkeypatch.setattr(
        lt.requests, "post", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no call expected"))
    )
    assert lt.translate_lines([], "EN") == []


def test_a_failed_overlay_is_dropped_rather_than_raised(monkeypatch):
    """The photo translation still succeeds; only the per-line overlay is lost."""
    monkeypatch.setattr(lt, "DEEPL_API_KEY", None)
    lines = [{"text": "Salida", "left": 1, "top": 2, "width": 3, "height": 4}]
    assert lt.translate_lines(lines, "EN") == []
