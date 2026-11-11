"""
One error shape for every failure this service returns:

    { "message": "Sentence a person can read.", "code": "not_found", "detail": ... }

`detail` is what FastAPI always sent (a string, or a list for validation
errors) and stays, so existing callers keep working; new callers read `message`
and branch on `code`, which is stable even when the wording changes.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    413: "too_large",
    422: "invalid_request",
    429: "rate_limited",
    500: "server_error",
    502: "provider_unavailable",
    503: "not_configured",
}


def code_for(status: int) -> str:
    return CODES.get(status, "client_error" if status < 500 else "server_error")


def message_of(detail) -> str:
    """A detail (string, or FastAPI's list of validation errors) as one sentence."""
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list) and detail and isinstance(detail[0], dict):
        text = str(detail[0].get("msg", "")).removeprefix("Value error, ")
        where = [str(p) for p in detail[0].get("loc", []) if p not in ("body", "query", "header", "path")]
        return f"{'.'.join(where)}: {text}" if where and text else (text or "The request was not valid.")
    return "Something went wrong."


def error_body(status: int, detail) -> dict:
    return {"message": message_of(detail), "code": code_for(status), "detail": detail}


def install(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(error_body(exc.status_code, exc.detail), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(error_body(422, jsonable_encoder(exc.errors())), status_code=422)
