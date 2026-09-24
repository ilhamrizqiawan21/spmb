"""Reusable FastAPI dependencies enforcing authentication and RBAC."""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import AuthenticationException, PermissionDeniedException
from app.core.session import SESSION_COOKIE_NAME, get_session_user_id
from app.models.user import User
from app.repositories.user_repository import UserRepository


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> User:
    """Resolve the authenticated user from the session cookie, or reject the request."""
    if session_token is None:
        raise AuthenticationException("Authentication is required.")

    user_id = await get_session_user_id(session_token)
    if user_id is None:
        raise AuthenticationException("Session is invalid or has expired.")

    user = await UserRepository(session).get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthenticationException("Account is unavailable.")

    return user


def require_permission(
    code: str,
) -> Callable[[User], Coroutine[Any, Any, User]]:
    """Build a dependency that denies access unless the user holds ``code``."""

    async def _dependency(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        granted = {permission.code for role in user.roles for permission in role.permissions}
        if code not in granted:
            raise PermissionDeniedException(
                f"Permission '{code}' is required for this action."
            )
        return user

    return _dependency
