import os
from fastapi import Header, HTTPException

secretKey = os.environ.get("superSecretKey")

async def verify_secretKey(node_secretKey: str = Header(...)):
    if not secretKey:
        # if we forgot to set the env var, fail closed instead of letting everything through
        raise HTTPException(status_code=500, detail="Server auth not configured")

    if node_secretKey != secretKey:
        raise HTTPException(status_code=401, detail="Unauthorized")
