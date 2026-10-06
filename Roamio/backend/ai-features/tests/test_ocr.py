"""run_ocr's failure paths: every one of them becomes an OcrError carrying a
status and a message that is safe to show a traveller (FR-19, NFR-22)."""

import pytest
import requests

import ocr.ocr as ocr_module
from ocr.ocr import OcrError, run_ocr

IMAGE = b"\xff\xd8\xfffake-jpeg-bytes"


class _Response:
    def __init__(self, payload=None, status_code=200):
        self._payload = payload or {}
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(response=self)

    def json(self):
        return self._payload


@pytest.fixture(autouse=True)
def _with_key(monkeypatch):
    monkeypatch.setattr(ocr_module, "OCR_SPACE_API_KEY", "test-ocr-key")


def _post(response=None, raises=None):
    def fake_post(url, files=None, data=None, headers=None, timeout=None):
        if raises is not None:
            raise raises
        return response

    return fake_post


def test_missing_key_is_a_configuration_error(monkeypatch):
    monkeypatch.setattr(ocr_module, "OCR_SPACE_API_KEY", None)
    with pytest.raises(OcrError) as caught:
        run_ocr(IMAGE)
    assert caught.value.status == 500


def test_timeout_becomes_504(monkeypatch):
    monkeypatch.setattr(ocr_module.requests, "post", _post(raises=requests.Timeout()))
    with pytest.raises(OcrError) as caught:
        run_ocr(IMAGE)
    assert caught.value.status == 504 and "timed out" in caught.value.message


@pytest.mark.parametrize("provider_status", [403, 429])
def test_quota_and_forbidden_become_429(monkeypatch, provider_status):
    monkeypatch.setattr(
        ocr_module.requests, "post", _post(_Response(status_code=provider_status))
    )
    with pytest.raises(OcrError) as caught:
        run_ocr(IMAGE)
    assert caught.value.status == 429 and "busy" in caught.value.message


def test_other_http_error_becomes_502(monkeypatch):
    monkeypatch.setattr(ocr_module.requests, "post", _post(_Response(status_code=500)))
    with pytest.raises(OcrError) as caught:
        run_ocr(IMAGE)
    assert caught.value.status == 502


def test_unreachable_provider_becomes_502(monkeypatch):
    monkeypatch.setattr(
        ocr_module.requests, "post", _post(raises=requests.ConnectionError("down"))
    )
    with pytest.raises(OcrError) as caught:
        run_ocr(IMAGE)
    assert caught.value.status == 502


def test_processing_error_becomes_422_with_the_providers_reason(monkeypatch):
    monkeypatch.setattr(
        ocr_module.requests,
        "post",
        _post(_Response({"IsErroredOnProcessing": True, "ErrorMessage": ["File size exceeded"]})),
    )
    with pytest.raises(OcrError) as caught:
        run_ocr(IMAGE)
    assert caught.value.status == 422 and caught.value.message == "File size exceeded"


def test_no_parsed_results_is_empty_not_an_error(monkeypatch):
    monkeypatch.setattr(ocr_module.requests, "post", _post(_Response({"ParsedResults": []})))
    assert run_ocr(IMAGE) == ("", [])


def test_success_returns_collapsed_text_and_positioned_lines(monkeypatch):
    payload = {
        "ParsedResults": [{
            "ParsedText": "Salida   de\r\nemergencia",
            "TextOverlay": {"Lines": [{
                "LineText": "Salida de emergencia",
                "MinTop": 12,
                "MaxHeight": 22,
                "Words": [
                    {"Left": 10, "Top": 12, "Width": 40, "Height": 22},
                    {"Left": 55, "Top": 13, "Width": 30, "Height": 20},
                ],
            }]},
        }]
    }
    monkeypatch.setattr(ocr_module.requests, "post", _post(_Response(payload)))

    text, lines = run_ocr(IMAGE)
    assert text == "Salida de emergencia"
    assert lines == [{"text": "Salida de emergencia", "left": 10, "top": 12, "width": 75, "height": 22}]
