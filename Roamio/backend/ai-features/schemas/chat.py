from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    # the Core API trims history; this is the backstop. Last message must be the user's.
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    # trip facts as plain text, assembled by the Core API (this service never reads the database)
    context: str = Field(default="", max_length=8000)


class ChatResponse(BaseModel):
    reply: str
