from fastapi import APIRouter, Depends, HTTPException

from chat.gemini import ChatUnavailable, reply
from config.auth import verify_secretKey
from schemas.chat import ChatRequest, ChatResponse

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_secretKey)])
def chat(body: ChatRequest):
    """Next assistant reply for a trip conversation (FR-37)."""
    if body.messages[-1].role != "user":
        raise HTTPException(status_code=422, detail="The last message must be from the user.")
    try:
        return {"reply": reply([m.model_dump() for m in body.messages], body.context)}
    except ChatUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
