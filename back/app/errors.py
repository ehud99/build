"""Errores de la API con la misma forma que forge: `{error_code, message, detail}`."""
from typing import Any, Optional

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, message: str, error_code: str, detail: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.error_code = error_code
        self.detail = detail


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    body: dict[str, Any] = {"error_code": exc.error_code, "message": exc.message}
    if exc.detail is not None:
        body["detail"] = exc.detail
    headers = {}
    if exc.status == 429 and exc.detail and "retry_after" in exc.detail:
        headers["Retry-After"] = str(exc.detail["retry_after"])
    return JSONResponse(status_code=exc.status, content=body, headers=headers)


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    message = str(first.get("msg", "Datos inválidos")).removeprefix("Value error, ")
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse(
        status_code=422,
        content={"error_code": "VALIDATION_ERROR", "message": message, "detail": {"field": field}},
    )
