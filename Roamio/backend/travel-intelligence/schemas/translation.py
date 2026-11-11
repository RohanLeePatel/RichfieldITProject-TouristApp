from typing import Optional

from pydantic import BaseModel, Field


class OverlayLine(BaseModel):
    text: str
    translation: str
    left: float
    top: float
    width: float
    height: float


class TranslationResponse(BaseModel):
    text: str
    detected_lang: Optional[str] = None
    translation: Optional[str] = None
    message: Optional[str] = None
    lines: list[OverlayLine] = []  # per-line translations with pixel boxes, for the photo overlay


class TextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    target_lang: Optional[str] = None
    source_lang: Optional[str] = None
