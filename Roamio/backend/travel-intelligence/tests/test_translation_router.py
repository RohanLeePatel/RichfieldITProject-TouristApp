"""Auth boundary, upload guards and happy paths for POST /ocr and POST /text
(FR-19, FR-32, NFR-33). The providers themselves are stubbed - ocr.ocr and
translation.live_translation are covered in test_ocr.py and test_translation.py."""

import importlib
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from ocr.ocr import OcrError

SECRET = {"node-secretkey": "test-secret"}
JPEG = b"\xff\xd8\xff" + b"0" * 64
LINE = {"text": "Salida", "left": 1, "top": 2, "width": 3, "height": 4}


@pytest.fixture
def app(monkeypatch):
    """The reloaded router module (to stub its providers) and a client for it."""
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import routers.translation_router as router_module

    importlib.reload(router_module)
    import main as main_module

    importlib.reload(main_module)
    return SimpleNamespace(router=router_module, client=TestClient(main_module.app))


def _translated(text, target_lang=None, source_lang=None):
    return {"detected_lang": "es", "translation": "Emergency exit", "message": None}


def _upload(data=JPEG):
    return {"image": ("sign.jpg", data, "image/jpeg")}


def _never(*args, **kwargs):
    raise AssertionError("should not have been called")


def test_ocr_requires_auth_header(app):
    assert app.client.post("/ocr", files=_upload()).status_code == 422


def test_ocr_rejects_wrong_secret(app):
    assert app.client.post("/ocr", files=_upload(), headers={"node-secretkey": "wrong"}).status_code == 401


def test_text_requires_auth_header(app):
    assert app.client.post("/text", json={"text": "hola"}).status_code == 422


def test_oversized_photo_is_rejected_before_any_provider_call(app, monkeypatch):
    monkeypatch.setattr(app.router, "run_ocr", _never)
    oversized = b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024)

    response = app.client.post("/ocr", files=_upload(oversized), headers=SECRET)
    assert response.status_code == 413


def test_a_file_that_is_not_an_image_is_rejected_by_its_signature(app, monkeypatch):
    """NFR-33: the type comes from the bytes, not from the declared content type."""
    monkeypatch.setattr(app.router, "run_ocr", _never)

    response = app.client.post(
        "/ocr", files={"image": ("doc.jpg", b"%PDF-1.4 ...", "image/jpeg")}, headers=SECRET
    )
    assert response.status_code == 415


def test_ocr_returns_text_translation_and_line_boxes(app, monkeypatch):
    monkeypatch.setattr(app.router, "run_ocr", lambda image_bytes: ("Salida de emergencia", [LINE]))
    monkeypatch.setattr(app.router, "translate_text", _translated)
    monkeypatch.setattr(
        app.router, "translate_lines", lambda lines, target, source=None: [{**LINE, "translation": "Exit"}]
    )

    response = app.client.post("/ocr", files=_upload(), data={"target_lang": "EN"}, headers=SECRET)
    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "Salida de emergencia"
    assert body["translation"] == "Emergency exit"
    assert body["detected_lang"] == "es"
    assert body["lines"][0]["translation"] == "Exit"


def test_no_overlay_is_returned_when_the_translation_failed(app, monkeypatch):
    monkeypatch.setattr(app.router, "run_ocr", lambda image_bytes: ("Salida", [LINE]))
    monkeypatch.setattr(
        app.router,
        "translate_text",
        lambda *a, **k: {
            "detected_lang": "es",
            "translation": None,
            "message": "The translation quota for this month has been used up.",
        },
    )
    monkeypatch.setattr(app.router, "translate_lines", _never)

    response = app.client.post("/ocr", files=_upload(), headers=SECRET)
    assert response.status_code == 200
    assert response.json()["lines"] == []
    assert "quota" in response.json()["message"]


def test_provider_error_keeps_its_status_and_message(app, monkeypatch):
    def busy(image_bytes):
        raise OcrError(429, "The text-reading service is busy or its limit was reached.")

    monkeypatch.setattr(app.router, "run_ocr", busy)

    response = app.client.post("/ocr", files=_upload(), headers=SECRET)
    assert response.status_code == 429
    assert "busy" in response.json()["detail"]


def test_typed_text_is_translated(app, monkeypatch):
    monkeypatch.setattr(app.router, "translate_text", _translated)

    response = app.client.post("/text", json={"text": "Salida de emergencia"}, headers=SECRET)
    assert response.status_code == 200
    body = response.json()
    assert body["text"] == "Salida de emergencia"
    assert body["translation"] == "Emergency exit"
    assert body["lines"] == []  # typed text has no photo to overlay


@pytest.mark.parametrize("text", ["", "x" * 2001])
def test_empty_or_overlong_text_is_rejected(app, text):
    assert app.client.post("/text", json={"text": text}, headers=SECRET).status_code == 422
