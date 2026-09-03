from pydantic import BaseModel
from typing import Optional


class TranslationResponse(BaseModel):
    text: str
    detected_lang: Optional[str] = None
    translation: Optional[str] = None
    message: Optional[str] = None
