"""Async SQLAlchemy engine, session dependency, and connectivity checks."""

from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    """Create the database engine only when infrastructure is needed."""
    settings = get_settings()
    return create_async_engine(settings.database_url.unicode_string(), pool_pre_ping=True)


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create the session factory bound to the lazily initialized engine."""
    return async_sessionmaker(get_engine(), expire_on_commit=False)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield one session per request and roll it back after an error."""
    async with get_session_factory()() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def check_database_connection() -> None:
    """Raise an exception when PostgreSQL cannot execute a simple query."""
    async with get_engine().connect() as connection:
        await connection.execute(text("SELECT 1"))


async def dispose_database_engine() -> None:
    """Close pooled connections during application shutdown."""
    if get_engine.cache_info().currsize:
        await get_engine().dispose()
        get_session_factory.cache_clear()
        get_engine.cache_clear()
