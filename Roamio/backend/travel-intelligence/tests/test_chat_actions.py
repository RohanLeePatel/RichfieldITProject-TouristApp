"""POST /chat tool calls: the assistant may ask to add a stop, never do it itself (FR-37)."""

import importlib

import pytest
import requests
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
        requests, "post",
        lambda url, headers, json, timeout: seen.update(json=json) or _Response(payload),
    )
    return seen


def test_the_tool_is_offered_only_when_the_traveller_may_edit(client, monkeypatch):
    seen = _spy(monkeypatch, {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})
    client.post("/chat", json=ASK, headers=SECRET)
    names = lambda: {f["name"] for f in seen["json"]["tools"][0]["functionDeclarations"]}
    assert names() == {"get_weather", "translate_text", "get_exchange_rate"}  # read-only, offered to everyone
    client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET)
    assert names() == {"get_weather", "translate_text", "get_exchange_rate", "add_itinerary_item", "remove_itinerary_item", "log_expense"}


def test_a_weather_call_is_answered_with_the_forecast_then_the_model_replies(client, monkeypatch):
    sent = []
    replies = [_call(name="get_weather", city="Cairo"), {"candidates": [{"content": {"parts": [{"text": "Warm, 28C."}]}}]}]
    monkeypatch.setattr(requests, "post", lambda url, headers, json, timeout: sent.append(json) or _Response(replies.pop(0)))
    monkeypatch.setattr(gemini, "get_weather", lambda city: {"city": city, "current": {"temp": 28}, "forecast": []})
    body = client.post("/chat", json=ASK, headers=SECRET).json()
    assert body["reply"] == "Warm, 28C."
    answer = sent[1]["contents"][-1]["parts"][0]["functionResponse"]["response"]["result"]
    assert answer["city"] == "Cairo" and answer["current"] == {"temp": 28}


def test_a_tool_call_comes_back_as_an_action_with_scrubbed_arguments(client, monkeypatch):
    _spy(monkeypatch, _call(title="uShaka Marine World", day=2, time="14:00", notes="ask for ada@example.com"))
    body = client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET).json()
    assert body["reply"] == ""
    assert body["action"]["name"] == "add_itinerary_item"
    assert body["action"]["args"]["title"] == "uShaka Marine World" and body["action"]["args"]["day"] == 2
    assert "ada@example.com" not in str(body)


def test_an_expense_tool_call_comes_back_as_an_action(client, monkeypatch):
    _spy(monkeypatch, _call(name="log_expense", title="Dinner", amount=180.5, category="FOOD"))
    body = client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET).json()
    assert body["action"] == {"name": "log_expense", "args": {"title": "Dinner", "amount": 180.5, "category": "FOOD"}}


def test_a_tool_call_is_ignored_when_editing_is_not_allowed_or_the_tool_is_unknown(client, monkeypatch):
    _spy(monkeypatch, _call(title="x"))
    response = client.post("/chat", json=ASK, headers=SECRET)  # can_edit false
    assert response.status_code == 502  # nothing to say and nothing to do
    _spy(monkeypatch, _call(name="delete_everything", title="x"))
    assert client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET).status_code == 502


def _tool_answer(monkeypatch, client, call, **patches):
    """Runs one chat where the model makes `call`, returns the result the model was given back."""
    sent = []
    replies = [call, {"candidates": [{"content": {"parts": [{"text": "done"}]}}]}]
    monkeypatch.setattr(requests, "post", lambda url, headers, json, timeout: sent.append(json) or _Response(replies.pop(0)))
    for name, fn in patches.items():
        monkeypatch.setattr(gemini, name, fn)
    assert client.post("/chat", json=ASK, headers=SECRET).json()["reply"] == "done"
    return sent[1]["contents"][-1]["parts"][0]["functionResponse"]["response"]["result"]


def test_translate_and_rate_tools_return_results(client, monkeypatch):
    got = _tool_answer(monkeypatch, client, _call(name="translate_text", text="Where is the station?", target_lang="FR"),
                       translate_text=lambda t, tl, sl: {"translation": "Où est la gare ?", "detected_lang": "en", "message": None})
    assert got["translation"] == "Où est la gare ?"
    got = _tool_answer(monkeypatch, client, _call(name="get_exchange_rate", base="usd", target="ZAR"),
                       rate_detail=lambda b, t: {"base": b, "target": t, "rate": 18.2, "fetched_at": None, "stale": False})
    assert got["rate"] == 18.2


def test_tool_arguments_are_validated_and_errors_come_back_as_words(client, monkeypatch):
    boom = lambda *a, **k: (_ for _ in ()).throw(AssertionError("must not be called"))
    for call, snippet in [
        (_call(name="get_exchange_rate", base="US", target="ZAR"), "3 letters"),
        (_call(name="get_exchange_rate", base="USD; DROP", target="ZAR"), "3 letters"),
        (_call(name="translate_text", text="x" * 301, target_lang="FR"), "too long"),
        (_call(name="translate_text", text="hello", target_lang="FR;rm"), "language code"),
        (_call(name="translate_text", text="  ", target_lang="FR"), "no text"),
    ]:
        got = _tool_answer(monkeypatch, client, call, translate_text=boom, rate_detail=boom)
        assert snippet in got["error"]


def test_a_failing_tool_does_not_take_the_chat_down(client, monkeypatch):
    boom = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("secret url"))
    got = _tool_answer(monkeypatch, client, _call(name="get_exchange_rate", base="USD", target="ZAR"), rate_detail=boom)
    assert got == {"error": "That lookup failed. Try again in a moment."}


def test_a_looping_model_is_cut_off_after_two_lookup_rounds(client, monkeypatch):
    sent = []
    monkeypatch.setattr(requests, "post", lambda url, headers, json, timeout: sent.append(1) or _Response(_call(name="get_weather", city="Cairo")))
    monkeypatch.setattr(gemini, "get_weather", lambda c: {"city": c, "current": {}, "forecast": []})
    assert client.post("/chat", json=ASK, headers=SECRET).status_code == 502
    assert len(sent) == 3  # the question plus two rounds, never more


def test_remove_stop_comes_back_as_an_action(client, monkeypatch):
    _spy(monkeypatch, _call(name="remove_itinerary_item", title="uShaka", day=2))
    body = client.post("/chat", json={**ASK, "can_edit": True}, headers=SECRET).json()
    assert body["action"] == {"name": "remove_itinerary_item", "args": {"title": "uShaka", "day": 2}}
