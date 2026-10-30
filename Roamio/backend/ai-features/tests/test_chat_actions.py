"""POST /chat tool calls: the assistant may ask to add a stop, never do it itself (FR-37)."""

import importlib

import pytest
from fastapi.testclient import TestClient

import chat.gemini as gemini

SECRET = {"node-secretkey": "test-secret"}
ASK = {"messages": [{"role": "user", "content": "add uShaka Marine World on day 2 at 14:00"}], "context": "Trip: Durban"}


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
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def _call(name="add_itinerary_item", **args):
    return {"candidates": [{"content": {"parts": [{"functionCall": {"name": name, "args": args}}]}}]}


def _spy(monkeypatch, payload):
    seen = {}
    monkeypatch.setattr(
        gemini.requests, "post",
        lambda url, headers, json, timeout: seen.update(json=json) or _Response(payload),
    )
    return seen


def test_the_tool_is_offered_only_when_the_traveller_may_edit(client, monkeypatch):
    seen = _spy(monkeypatch, {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})
    client.post("/chat", json=ASK, headers=SECRET)
    assert "tools" not in seen["json"]
    client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET)
    assert seen["json"]["tools"][0]["functionDeclarations"][0]["name"] == "add_itinerary_item"


def test_a_tool_call_comes_back_as_an_action_with_scrubbed_arguments(client, monkeypatch):
    _spy(monkeypatch, _call(title="uShaka Marine World", day=2, time="14:00", notes="ask for ada@example.com"))
    body = client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET).json()
    assert body["reply"] == ""
    assert body["action"]["name"] == "add_itinerary_item"
    assert body["action"]["args"]["title"] == "uShaka Marine World" and body["action"]["args"]["day"] == 2
    assert "ada@example.com" not in str(body)


def test_a_tool_call_is_ignored_when_editing_is_not_allowed_or_the_tool_is_unknown(client, monkeypatch):
    _spy(monkeypatch, _call(title="x"))
    response = client.post("/chat", json=ASK, headers=SECRET)  # can_edit false
    assert response.status_code == 502  # nothing to say and nothing to do
    _spy(monkeypatch, _call(name="delete_everything", title="x"))
    assert client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET).status_code == 502
