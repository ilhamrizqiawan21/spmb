"""FastAPI application entry point."""

from asyncio import wait_for
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.cache import check_cache_connection, close_cache
from app.core.config import get_settings
from app.core.database import check_database_connection, dispose_database_engine
from app.core.handlers import register_exception_handlers


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Release shared database resources when the application stops."""
    try:
        yield
    finally:
        try:
            await dispose_database_engine()
        finally:
            await close_cache()


def create_app() -> FastAPI:
    """Create the configured FastAPI application."""
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )
    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "app": settings.app_name,
            "version": app.version,
            "environment": settings.app_env,
        }

    @app.get("/ready", tags=["health"])
    async def ready() -> dict[str, str]:
        try:
            await wait_for(check_database_connection(), timeout=3)
            await wait_for(check_cache_connection(), timeout=3)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Required infrastructure is unavailable",
            ) from exc
        return {"status": "ready", "database": "ok", "redis": "ok"}

    return app


app = create_app()
