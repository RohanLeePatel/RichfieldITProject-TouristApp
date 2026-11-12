"""History routes under /api/translate. Supabase, OCR and DeepL are stubbed."""

import importlib
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from services import storage_service
from services.storage_service import StorageError


def _signed(user_id="user-1"):
    import time

    from config.user_assertion import sign

    ts = str(int(time.time()))
    return {"node-secretkey": "test-secret", "x-user-id": user_id, "x-user-ts": ts, "x-user-sig": sign(user_id, ts)}


H = {"node-secretkey": "test-secret", "x-user-id": "user-1"}  # unsigned: treated as anonymous
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
    r = app.client.post("/api/translate/text", json={"text": "Salida", "target_lang": "EN"}, headers=_signed())
    assert r.json()["history_id"] == "hid-1"
    assert app.saved[0]["translation_type"] == "TEXT" and app.saved[0]["user_id"] == "user-1"


def test_text_not_saved_when_opted_out_or_guest(app):
    app.client.post("/api/translate/text", json={"text": "Salida", "save_history": False}, headers=_signed())
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
                        data={"target_lang": "EN"}, headers=_signed())
    body = r.json()
    assert r.status_code == 200 and body["translation"] == "Emergency exit"
    assert body["image_url"] is None and app.saved[0]["image_url"] is None


def test_camera_saves_unless_opted_out(app, monkeypatch):
    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", lambda *a: None)
    photo = {"image": ("s.jpg", JPEG, "image/jpeg")}
    app.client.post("/api/translate/camera", files=photo, headers=_signed())  # flag omitted, like the frontend
    app.client.post("/api/translate/camera", files=photo, data={"save_history": "false"}, headers=_signed())
    assert [r["translation_type"] for r in app.saved] == ["IMAGE_CAMERA"]


def test_camera_removes_photos_past_the_limit(app, monkeypatch):
    removed = []
    monkeypatch.setattr(app.router.storage_service, "upload_translation_image", lambda *a: "http://x/new.jpg")
    monkeypatch.setattr(app.router.history_service, "prune_photos", lambda user_id: [f"http://x/{user_id}-old.jpg"])
    monkeypatch.setattr(app.router.storage_service, "delete_translation_image", removed.append)
    r = app.client.post("/api/translate/camera", files={"image": ("s.jpg", JPEG, "image/jpeg")}, headers=_signed())
    assert r.json()["history_saved"] is True and removed == ["http://x/user-1-old.jpg"]


def test_prune_photos_keeps_the_newest(monkeypatch):
    from services import history_service

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
    r = app.client.post("/api/translate/camera", files={"image": ("s.jpg", JPEG, "image/jpeg")}, headers=_signed())
    assert r.status_code == 200 and r.json()["history_saved"] is False


def test_history_requires_user(app):
    assert app.client.get("/api/translate/history", headers={"node-secretkey": "test-secret"}).status_code == 401


def test_unsigned_or_forged_user_id_is_not_trusted(app):
    # holding the shared key is not enough: an unsigned x-user-id is anonymous
    assert app.client.delete("/api/translate/history", headers=H).status_code == 401
    forged = {**_signed("user-1"), "x-user-id": "user-2"}
    assert app.client.delete("/api/translate/history", headers=forged).status_code == 401
    stale = {**_signed("user-1"), "x-user-ts": "1"}
    assert app.client.delete("/api/translate/history", headers=stale).status_code == 401


def test_delete_other_users_record_is_404(app, monkeypatch):
    monkeypatch.setattr(app.router.history_service, "delete_record", lambda u, i: None)
    r = app.client.delete("/api/translate/history/" + "0" * 8 + "-0000-0000-0000-" + "0" * 12, headers=_signed())
    assert r.status_code == 404


def test_delete_removes_stored_image(app, monkeypatch):
    removed = []
    monkeypatch.setattr(app.router.history_service, "delete_record", lambda u, i: {"image_url": "http://x/img.jpg"})
    monkeypatch.setattr(app.router.storage_service, "delete_translation_image", removed.append)
    r = app.client.delete("/api/translate/history/" + "0" * 8 + "-0000-0000-0000-" + "0" * 12, headers=_signed())
    assert r.status_code == 200 and removed == ["http://x/img.jpg"]


def test_delete_all_removes_rows_and_stored_images(app, monkeypatch):
    calls = []
    monkeypatch.setattr(app.router.history_service, "delete_all", lambda u: calls.append(("history", u)) or 2)
    monkeypatch.setattr(app.router.storage_service, "delete_translation_images", lambda u: calls.append(("photos", u)))
    r = app.client.delete("/api/translate/history", headers=_signed())
    assert r.status_code == 200 and r.json() == {"deleted": 2}
    assert calls == [("photos", "user-1"), ("history", "user-1")]


def test_delete_all_requires_user(app):
    assert app.client.delete("/api/translate/history", headers={"node-secretkey": "test-secret"}).status_code == 401


def test_delete_all_preserves_history_when_storage_fails(app, monkeypatch):
    def boom(user_id):
        raise RuntimeError("down")

    removed = []
    monkeypatch.setattr(app.router.history_service, "delete_all", removed.append)
    monkeypatch.setattr(app.router.storage_service, "delete_translation_images", boom)
    assert app.client.delete("/api/translate/history", headers=_signed()).status_code == 503
    assert not removed


def test_delete_all_only_touches_that_user(monkeypatch):
    from services import history_service

    calls = []

    class Query:
        count = 2

        def __getattr__(self, name):
            return lambda *a, **k: calls.append((name, a)) or self

    monkeypatch.setattr(history_service, "get_client", lambda: SimpleNamespace(table=lambda t: Query()))
    assert history_service.delete_all("user-1") == 2
    assert ("eq", ("user_id", "user-1")) in calls


def test_delete_translation_images_paginates_and_stays_in_user_folder(monkeypatch):
    removed = []
    offsets = []

    def list_files(folder, options):
        assert folder == "user-1"
        offset = options["offset"]
        offsets.append(offset)
        return [{"name": f"{i}.jpg"} for i in range(offset, min(offset + options["limit"], 102))]

    bucket = SimpleNamespace(list=list_files, remove=removed.extend)
    monkeypatch.setattr(storage_service, "get_client", lambda: SimpleNamespace(storage=SimpleNamespace(from_=lambda _: bucket)))
    storage_service.delete_translation_images("user-1")
    assert offsets == [0, 100]
    assert removed == [f"user-1/{i}.jpg" for i in range(102)]


def test_upload_validation():
    with pytest.raises(StorageError):
        storage_service.upload_translation_image(b"x", "image/gif", None)
    with pytest.raises(StorageError):
        storage_service.upload_translation_image(b"x" * (10 * 1024 * 1024 + 1), "image/png", None)
