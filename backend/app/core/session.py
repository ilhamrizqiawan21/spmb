"""Server-side session store backed by Redis.

Sessions are opaque, revocable tokens rather than self-contained JWTs so
logout takes effect immediately. The cookie only ever carries the token;
the user identity lives in Redis.
"""

import secrets
from datetime import timedelta
from uuid import UUID

from app.core.cache import get_cache

SESSION_COOKIE_NAME = "spmb_session"
SESSION_TTL = timedelta(hours=12)
_SESSION_KEY_PREFIX = "session:"


def _session_key(token: str) -> str:
    return f"{_SESSION_KEY_PREFIX}{token}"


async def create_session(user_id: UUID) -> str:
    """Create a new opaque session token bound to ``user_id``."""
    token = secrets.token_urlsafe(32)
    await get_cache().set(_session_key(token), str(user_id), ex=SESSION_TTL)
    return token


async def get_session_user_id(token: str) -> UUID | None:
    """Return the user id bound to ``token``, or ``None`` if absent/expired."""
    raw = await get_cache().get(_session_key(token))
    if raw is None:
        return None
    return UUID(raw)


async def delete_session(token: str) -> None:
    """Revoke a session token immediately."""
    await get_cache().delete(_session_key(token))
