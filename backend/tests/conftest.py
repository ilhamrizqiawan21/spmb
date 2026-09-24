"""Shared pytest fixtures.

An ephemeral PostgreSQL instance (via ``pgserver``) and an in-process
Redis-compatible server (via ``fakeredis``) are started once per test
session so integration tests exercise real database/cache behavior
instead of only checking ORM metadata. Neither package is a runtime
dependency of the application; both are dev/test-only.
"""

import os
import tempfile
from collections.abc import AsyncGenerator

import fakeredis.aioredis as fakeredis_aioredis
import pgserver
import pytest
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_PG_DATA_DIR = tempfile.mkdtemp(prefix="spmb-test-pg-")
_pg_server = pgserver.get_server(_PG_DATA_DIR)
_pg_server.psql("CREATE DATABASE spmb_test;")

_socket_dir = _pg_server.get_postmaster_info().socket_dir
os.environ["DATABASE_URL"] = (
    f"postgresql+psycopg://postgres@localhost/spmb_test?host={_socket_dir}"
)
os.environ.setdefault("APP_ENV", "development")

_fake_cache = fakeredis_aioredis.FakeRedis(decode_responses=True)
Redis.from_url = classmethod(lambda cls, *args, **kwargs: _fake_cache)  # type: ignore[method-assign]

from alembic.config import Config  # noqa: E402

from alembic import command  # noqa: E402

_alembic_cfg = Config("alembic.ini")
command.upgrade(_alembic_cfg, "head")

from app.core.database import get_engine, get_session_factory  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """A session for direct row manipulation not reachable via the public API."""
    async with get_session_factory()() as session:
        yield session


@pytest.fixture(autouse=True)
async def _reset_mutable_state() -> AsyncGenerator[None, None]:
    """Keep tests isolated: wipe per-test rows and cache state, keep RBAC seed data."""
    yield
    async with get_engine().begin() as conn:
        await conn.execute(text("TRUNCATE TABLE user_roles, users CASCADE"))
    await _fake_cache.flushall()
