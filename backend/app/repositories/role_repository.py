"""Data access for roles and role assignments."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.role import Role
from app.models.user_role import UserRole


class RoleRepository:
    """Encapsulates persistence access for :class:`Role` and role grants."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_code(self, code: str) -> Role | None:
        result = await self._session.execute(select(Role).where(Role.code == code))
        return result.scalar_one_or_none()

    async def assign_role_to_user(self, user_id: UUID, role_id: UUID) -> None:
        self._session.add(UserRole(user_id=user_id, role_id=role_id))
        await self._session.flush()
