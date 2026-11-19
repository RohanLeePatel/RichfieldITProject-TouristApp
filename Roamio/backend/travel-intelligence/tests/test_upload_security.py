"""Oversized uploads must be refused without reading an unbounded stream."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.translation_history_router import translate_camera_with_history
from routers.translation_router import MAX_IMAGE_BYTES, ocr_and_translate


@pytest.mark.parametrize("handler", [ocr_and_translate, translate_camera_with_history])
def test_upload_read_is_bounded_before_ocr(handler):
    reads = []

    def read(size=-1):
        assert 0 < size <= MAX_IMAGE_BYTES + 1
        reads.append(size)
        return b"x" * size

    with pytest.raises(HTTPException) as error:
        image = SimpleNamespace(file=SimpleNamespace(read=read))
        if handler is translate_camera_with_history:
            handler(image=image, x_user_id=None, save_history="false")
        else:
            handler(image=image)
    assert error.value.status_code == 413
    assert reads == [MAX_IMAGE_BYTES + 1]
