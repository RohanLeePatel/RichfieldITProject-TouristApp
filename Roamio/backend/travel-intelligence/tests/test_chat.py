"""Auth boundary + happy/error paths for POST /chat (FR-37). Gemini is stubbed."""

import importlib

import pytest
import requests
from fastapi.testclient import TestClient

import chat.gemini as gemini

SECRET = {"node-secretkey": "test-secret"}
BODY = {"messages": [{"role": "user", "content": "What is on day 2?"}], "context": "Trip: Durban"}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", "test-key")
    return TestClient(main_module.app)


class _Response:
    def __init__(self, payload, fail=False):
        self._payload, self._fail = payload, fail

    def raise_for_status(self):
        if self._fail:
            raise requests.HTTPError("boom")

    def json(self):
        return self._payload


def _answer(text):
    return {"candidates": [{"content": {"parts": [{"text": text}]}}]}


def test_requires_service_key(client):
    assert client.post("/chat", json=BODY).status_code == 422
    assert client.post("/chat", json=BODY, headers={"node-secretkey": "wrong"}).status_code == 401


def test_returns_reply_and_sends_context_and_key_in_header(client, monkeypatch):
    seen = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json)
        return _Response(_answer("Beach day."))

    monkeypatch.setattr(requests, "post", fake_post)
    response = client.post("/chat", json=BODY, headers=SECRET)
    assert response.status_code == 200
    assert response.json() == {"reply": "Beach day.", "action": None}
    assert "test-key" not in seen["url"]
    assert seen["headers"]["x-goog-api-key"] == "test-key"
    assert "Trip: Durban" in seen["json"]["systemInstruction"]["parts"][0]["text"]


def test_assistant_role_maps_to_model_and_empty_context_is_said(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(requests, "post", lambda url, headers, json, timeout: seen.update(json=json) or _Response(_answer("ok")))
    body = {"messages": [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}, {"role": "user", "content": "and?"}]}
    assert client.post("/chat", json=body, headers=SECRET).status_code == 200
    assert [c["role"] for c in seen["json"]["contents"]] == ["user", "model", "user"]
    assert "none selected" in seen["json"]["systemInstruction"]["parts"][0]["text"]


def test_last_message_must_be_user(client):
    body = {"messages": [{"role": "assistant", "content": "hello"}]}
    assert client.post("/chat", json=body, headers=SECRET).status_code == 422


def test_rejects_oversize_message(client):
    body = {"messages": [{"role": "user", "content": "x" * 2001}]}
    assert client.post("/chat", json=body, headers=SECRET).status_code == 422


def test_provider_failure_is_502_without_provider_text(client, monkeypatch):
    monkeypatch.setattr(requests, "post", lambda url, headers, json, timeout: _Response({}, fail=True))
    response = client.post("/chat", json=BODY, headers=SECRET)
    assert response.status_code == 502
    assert "boom" not in response.text


def test_empty_or_malformed_answer_is_502(client, monkeypatch):
    for payload in ({"candidates": []}, _answer("   ")):
        monkeypatch.setattr(requests, "post", lambda url, headers, json, timeout, p=payload: _Response(p))
        assert client.post("/chat", json=BODY, headers=SECRET).status_code == 502


def test_missing_key_is_502(client, monkeypatch):
    monkeypatch.setattr(gemini, "GEMINI_API_KEY", None)
    assert client.post("/chat", json=BODY, headers=SECRET).status_code == 502
