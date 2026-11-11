from typing import Optional

from pydantic import BaseModel


class RateResponse(BaseModel):
    base: str
    target: str
    rate: float
    # null when base == target (no provider call was needed); `stale` is true when
    # the provider is failing and this came from an expired cache entry
    fetched_at: Optional[str] = None
    stale: bool = False
