import os
from fastapi import Header, HTTPException

secretKey = os.environ.get("superSecretKey")

async def verify_secretKey(node_secretKey: str = Header(...)):
    if not secretKey:
        # Misconfiguration on our side — fail closed, not open.
        raise HTTPException(status_code=500, detail="Server auth not configured")

    if node_secretKey != secretKey:
        raise HTTPException(status_code=401, detail="Unauthorized")
