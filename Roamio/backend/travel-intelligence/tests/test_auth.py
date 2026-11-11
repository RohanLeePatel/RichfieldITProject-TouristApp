"""The service-key boundary itself (NFR-11). Route-level coverage lives in each
router's test file; this covers the comparison."""

import asyncio
import importlib

import pytest
from fastapi import HTTPException


@pytest.fixture
def auth(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    return auth_module


async def _verify(auth_module, key):
    return await auth_module.verify_secretKey(key)


def test_correct_key_passes(auth):
    assert asyncio.run(_verify(auth, "test-secret")) is None


@pytest.mark.parametrize("wrong", ["", "nope", "test-secre", "test-secretx", "ké", "ключ"])
def test_wrong_keys_are_rejected_without_crashing(auth, wrong):
    """Non-ASCII included: hmac.compare_digest refuses non-ASCII str, so the
    comparison must run on bytes or a junk header would 500 instead of 401."""
    with pytest.raises(HTTPException) as caught:
        asyncio.run(_verify(auth, wrong))
    assert caught.value.status_code == 401


def test_unconfigured_service_fails_closed(monkeypatch):
    monkeypatch.delenv("superSecretKey", raising=False)
    import config.auth as auth_module

    importlib.reload(auth_module)

    with pytest.raises(HTTPException) as caught:
        asyncio.run(_verify(auth_module, "anything"))
    assert caught.value.status_code == 500
