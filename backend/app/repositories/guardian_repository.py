"""Data access for the ``guardians`` table."""

import builtins
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guardian import Guardian


class GuardianRepository:
    """Encapsulates all persistence access for :class:`Guardian`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, id: UUID) -> Guardian | None:
        result = await self._session.execute(select(Guardian).where(Guardian.id == id))
        return result.scalar_one_or_none()

    async def get_by_applicant_and_relationship(
        self, applicant_id: UUID, relationship: str
    ) -> Guardian | None:
        result = await self._session.execute(
            select(Guardian).where(
                Guardian.applicant_id == applicant_id,
                Guardian.relationship == relationship,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_applicant(
        self, applicant_id: UUID
    ) -> builtins.list[Guardian]:
        result = await self._session.execute(
            select(Guardian)
            .where(Guardian.applicant_id == applicant_id)
            .order_by(Guardian.created_at.asc())
        )
        return list(result.scalars().all())

    async def clear_primary_contact(
        self, applicant_id: UUID, except_id: UUID | None = None
    ) -> None:
        """Clear primary contact flag from all guardians of this applicant."""
        stmt = update(Guardian).where(
            Guardian.applicant_id == applicant_id,
            Guardian.is_primary_contact.is_(True),
        )
        if except_id is not None:
            stmt = stmt.where(Guardian.id != except_id)
        stmt = stmt.values(is_primary_contact=False)
        await self._session.execute(stmt)
        await self._session.flush()

    async def create(self, guardian: Guardian) -> Guardian:
        self._session.add(guardian)
        await self._session.flush()
        await self._session.refresh(guardian)
        return guardian

    async def update(self, guardian: Guardian) -> Guardian:
        await self._session.flush()
        await self._session.refresh(guardian)
        return guardian

    async def delete(self, guardian: Guardian) -> None:
        await self._session.delete(guardian)
        await self._session.flush()
