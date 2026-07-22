"""
app/core/middleware.py
=======================
Middleware stack:
  1. RequestLoggingMiddleware  — logs every request with timing
  2. Global exception handler  — converts all errors to structured JSON
  3. ProcessTimeHeader          — adds X-Process-Time to every response
"""

import time
import uuid
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from loguru import logger


def add_middleware(app: FastAPI) -> None:
    """Register all middleware + exception handlers on the app."""

    # ── 1. Request timing + logging ──────────────────────────────────────────
    @app.middleware("http")
    async def log_requests(request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())[:8]
        start = time.perf_counter()

        logger.info(
            f"[{request_id}] → {request.method} {request.url.path}"
        )

        response = await call_next(request)

        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time-Ms"] = f"{elapsed_ms:.1f}"

        logger.info(
            f"[{request_id}] ← {response.status_code} "
            f"({elapsed_ms:.1f}ms)"
        )
        return response

    # ── 2. Global exception handler ───────────────────────────────────────────
    @app.exception_handler(Exception)
    async def unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred. Please try again.",
                "detail": str(exc) if app.debug else None,
            },
        )

    # ── 3. 404 handler ────────────────────────────────────────────────────────
    from fastapi.exceptions import RequestValidationError
    from fastapi import HTTPException

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for e in exc.errors():
            errors.append({
                "field": " → ".join(str(x) for x in e["loc"]),
                "message": e["msg"],
                "type": e["type"],
            })
        return JSONResponse(
            status_code=422,
            content={
                "error": "validation_error",
                "message": "Request data is invalid.",
                "errors": errors,
            },
        )

    @app.exception_handler(HTTPException)
    async def http_exception(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": _status_to_code(exc.status_code),
                "message": exc.detail,
            },
        )


def _status_to_code(status: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        413: "file_too_large",
        415: "unsupported_media_type",
        422: "unprocessable_entity",
        429: "rate_limit_exceeded",
        500: "internal_server_error",
        503: "service_unavailable",
    }.get(status, "error")
