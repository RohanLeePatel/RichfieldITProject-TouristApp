"""History routes under /api/translate. Supabase, OCR and DeepL are stubbed."""

import importlib
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import storage_service
from storage_service import StorageError

H = {"node-secretkey": "test-secret", "x-user-id": "user-1"}
JPEG = b"\xff\xd8\xff" + b"0" * 64
TRANSLATED = {"detected_lang": "es", "translation": "Emergency exit", "message": None}


@pytest.fixture
def app(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import routers.translation_history_router as router_module

    importlib.reload(router_module)
    import main as main_module

    importlib.reload(main_module)
    saved = []
    monkeypatch.setattr(router_module, "translate_text", lambda *a, **k: TRANSLATED)
    monkeypatch.setattr(router_module, "translate_lines", lambda *a, **k: [])
    monkeypatch.setattr(router_module, "run_ocr", lambda b: ("Salida", []))
    monkeypatch.setattr(router_module.history_service, "save_record", lambda r: saved.append(r) or "hid-1")
    monkeypatch.setattr(router_module.history_service, "prune_photos", lambda user_id: [])
    return SimpleNamespace(router=router_module, client=TestClient(main_module.app), saved=saved)


def test_text_is_saved_for_a_known_user(app):
    r = app.client.post("/api/translate/text", json={"text": "Salida", "target_lang": "EN"}, headers=H)
    assert r.json()["history_id"] == "hid-1"
    assert app.saved[0]["translation_type"] == "TEXT" and app.saved[0]["user_id"] == "user-1"


def test_text_not_saved_when_opted_out_or_guest(app):
    app.client.post("/api/translate/text", json={"text": "Salida", "save_history": False}, headers=H)
    app.client.post("/api/translate/text", json={"text": "Salida"}, headers={"node-secretkey": "test-secret"})
    assert app.saved == []


def test_camera_does_not_store_a_guest_photo(app, monkeypatch):
    uploaded = []
    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", lambda *a: uploaded.append(a))
    r = app.client.post("/api/translate/camera", files={"image": ("s.jpg", JPEG, "image/jpeg")},
                        headers={"node-secretkey": "test-secret"})
    assert r.status_code == 200 and r.json()["translation"] == "Emergency exit"
    assert uploaded == [] and app.saved == []


def test_camera_survives_upload_failure(app, monkeypatch):
    def boom(*a, **k):
        raise StorageError("down")

    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", boom)
    r = app.client.post("/api/translate/camera", files={"image": ("s.jpg", JPEG, "image/jpeg")},
                        data={"target_lang": "EN"}, headers=H)
    body = r.json()
    assert r.status_code == 200 and body["translation"] == "Emergency exit"
    assert body["image_url"] is None and app.saved[0]["image_url"] is None


def test_camera_saves_unless_opted_out(app, monkeypatch):
    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", lambda *a: None)
    photo = {"image": ("s.jpg", JPEG, "image/jpeg")}
    app.client.post("/api/translate/camera", files=photo, headers=H)  # flag omitted, like the frontend
    app.client.post("/api/translate/camera", files=photo, data={"save_history": "false"}, headers=H)
    assert [r["translation_type"] for r in app.saved] == ["IMAGE_CAMERA"]


def test_camera_removes_photos_past_the_limit(app, monkeypatch):
    removed = []
    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", lambda *a: "http://x/new.jpg")
    monkeypatch.setattr(app.router.history_service, "prune_photos", lambda user_id: [f"http://x/{user_id}-old.jpg"])
    monkeypatch.setattr(app.router.storage_service, "delete_translation_image", removed.append)
    r = app.client.post("/api/translate/camera", files={"image": ("s.jpg", JPEG, "image/jpeg")}, headers=H)
    assert r.json()["history_saved"] is True and removed == ["http://x/user-1-old.jpg"]


def test_prune_photos_keeps_the_newest(monkeypatch):
    import history_service

    calls = []

    class Query:
        def __init__(self):
            self.data = [{"id": "a", "image_url": "u1"}, {"id": "b", "image_url": None}]

        def __getattr__(self, name):
            return lambda *a, **k: calls.append((name, a)) or self

    monkeypatch.setattr(history_service, "get_client", lambda: SimpleNamespace(table=lambda t: Query()))
    assert history_service.prune_photos("user-1") == ["u1"]
    assert ("range", (15, 114)) in calls and ("in_", ("id", ["a", "b"])) in calls


def test_camera_survives_db_failure(app, monkeypatch):
    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", lambda *a: "http://x/img.jpg")
    monkeypatch.setattr(app.router.history_service, "save_record", lambda r: None)
    r = app.client.post("/api/translate/camera", files={"image": ("s.jpg", JPEG, "image/jpeg")}, headers=H)
    assert r.status_code == 200 and r.json()["history_saved"] is False


def test_history_requires_user(app):
    assert app.client.get("/api/translate/history", headers={"node-secretkey": "test-secret"}).status_code == 401


def test_delete_other_users_record_is_404(app, monkeypatch):
    monkeypatch.setattr(app.router.history_service, "delete_record", lambda u, i: None)
    r = app.client.delete("/api/translate/history/" + "0" * 8 + "-0000-0000-0000-" + "0" * 12, headers=H)
    assert r.status_code == 404


def test_delete_removes_stored_image(app, monkeypatch):
    removed = []
    monkeypatch.setattr(app.router.history_service, "delete_record", lambda u, i: {"image_url": "http://x/img.jpg"})
    monkeypatch.setattr(app.router.storage_service, "delete_translation_image", removed.append)
    r = app.client.delete("/api/translate/history/" + "0" * 8 + "-0000-0000-0000-" + "0" * 12, headers=H)
    assert r.status_code == 200 and removed == ["http://x/img.jpg"]


def test_delete_all_removes_rows_and_stored_images(app, monkeypatch):
    removed = []
    monkeypatch.setattr(app.router.history_service, "delete_all", lambda u: [{"image_url": "http://x/a.jpg"}, {"image_url": None}])
    monkeypatch.setattr(app.router.storage_service, "delete_translation_image", removed.append)
    r = app.client.delete("/api/translate/history", headers=H)
    assert r.status_code == 200 and r.json() == {"deleted": 2} and removed == ["http://x/a.jpg"]


def test_delete_all_requires_user(app):
    assert app.client.delete("/api/translate/history", headers={"node-secretkey": "test-secret"}).status_code == 401


def test_delete_all_reports_unavailable_history(app, monkeypatch):
    def boom(user_id):
        raise RuntimeError("down")

    monkeypatch.setattr(app.router.history_service, "delete_all", boom)
    assert app.client.delete("/api/translate/history", headers=H).status_code == 503


def test_delete_all_only_touches_that_user(monkeypatch):
    import history_service

    calls = []

    class Query:
        data = [{"image_url": "u1"}]

        def __getattr__(self, name):
            return lambda *a, **k: calls.append((name, a)) or self

    monkeypatch.setattr(history_service, "get_client", lambda: SimpleNamespace(table=lambda t: Query()))
    assert history_service.delete_all("user-1") == [{"image_url": "u1"}]
    assert ("eq", ("user_id", "user-1")) in calls


def test_upload_validation():
    with pytest.raises(StorageError):
        storage_service.upload_translation_image(b"x", "image/gif", None)
    with pytest.raises(StorageError):
        storage_service.upload_translation_image(b"x" * (10 * 1024 * 1024 + 1), "image/png", None)
