from fastapi import APIRouter, Depends, HTTPException, Path

from config.auth import verify_secretKey
from engine.currency import rate_detail
from schemas.rates import RateResponse

router = APIRouter()


def _currency_code() -> Path:
    # one instance per parameter: FastAPI keys its parameter metadata by the
    # default object, so sharing one Path() between both collapses them into one
    return Path(pattern="^[A-Za-z]{3}$", description="ISO 4217 code, e.g. ZAR")


@router.get("/rates/{base}/{target}", response_model=RateResponse, dependencies=[Depends(verify_secretKey)])
def exchange_rate(base: str = _currency_code(), target: str = _currency_code()):
    """One unit of `base` in `target`. The Core API stores this with an expense
    recorded in a currency other than the trip currency (FR-13)."""
    detail = rate_detail(base, target)
    if detail is None:
        raise HTTPException(status_code=503, detail="Exchange rates are unavailable right now.")
    return detail
