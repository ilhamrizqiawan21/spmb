"""Data access for the ``users`` table."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Role
from app.models.user import User

_WITH_ROLES_AND_PERMISSIONS = selectinload(User.roles).selectinload(Role.permissions)


class UserRepository:
    """Encapsulates all persistence access for :class:`User`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(User).where(User.id == user_id).options(_WITH_ROLES_AND_PERMISSIONS)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.email == email).options(_WITH_ROLES_AND_PERMISSIONS)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> User | None:
        result = await self._session.execute(
            select(User).where(User.phone == phone).options(_WITH_ROLES_AND_PERMISSIONS)
        )
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self._session.add(user)
        await self._session.flush()
        return user

    async def mark_logged_in(self, user: User) -> None:
        user.last_login_at = datetime.now(UTC)
        await self._session.flush()
