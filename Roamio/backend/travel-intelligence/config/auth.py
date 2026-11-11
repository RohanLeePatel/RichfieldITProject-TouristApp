import hmac

from fastapi import Header, HTTPException

from config import settings

secretKey = settings.get("superSecretKey")

async def verify_secretKey(node_secretKey: str = Header(...)):
    if not secretKey:
        # if we forgot to set the env var, fail closed instead of letting everything through
        raise HTTPException(status_code=500, detail="Server auth not configured")

    # compare_digest instead of != so a wrong key can't be guessed byte by byte
    # off the response time. Both sides are encoded first: compare_digest refuses
    # non-ASCII str, and the header is whatever the caller sent.
    if not hmac.compare_digest(node_secretKey.encode(), secretKey.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")
