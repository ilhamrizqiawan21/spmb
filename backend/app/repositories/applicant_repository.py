"""Data access for the ``applicants`` table."""

import builtins
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.applicant import Applicant

_WITH_GUARDIANS = selectinload(Applicant.guardians)


class ApplicantRepository:
    """Encapsulates all persistence access for :class:`Applicant`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(
        self, id: UUID, include_guardians: bool = True
    ) -> Applicant | None:
        query = select(Applicant).where(Applicant.id == id)
        if include_guardians:
            query = query.options(_WITH_GUARDIANS)
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def list_by_owner(
        self,
        owner_user_id: UUID,
        skip: int = 0,
        limit: int = 50,
        include_guardians: bool = True,
    ) -> tuple[builtins.list[Applicant], int]:
        query = select(Applicant).where(Applicant.owner_user_id == owner_user_id)
        count_query = select(func.count(Applicant.id)).where(
            Applicant.owner_user_id == owner_user_id
        )

        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        if include_guardians:
            query = query.options(_WITH_GUARDIANS)

        items_result = await self._session.execute(
            query.order_by(Applicant.created_at.desc()).offset(skip).limit(limit)
        )
        items = list(items_result.scalars().all())
        return items, total

    async def list_all(
        self,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
        include_guardians: bool = True,
    ) -> tuple[builtins.list[Applicant], int]:
        query = select(Applicant)
        count_query = select(func.count(Applicant.id))

        if search:
            search_filter = or_(
                Applicant.full_name.ilike(f"%{search}%"),
                Applicant.nisn.ilike(f"%{search}%"),
                Applicant.nik.ilike(f"%{search}%"),
            )
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)

        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        if include_guardians:
            query = query.options(_WITH_GUARDIANS)

        items_result = await self._session.execute(
            query.order_by(Applicant.created_at.desc()).offset(skip).limit(limit)
        )
        items = list(items_result.scalars().all())
        return items, total

    async def create(self, applicant: Applicant) -> Applicant:
        self._session.add(applicant)
        await self._session.flush()
        reloaded = await self.get_by_id(applicant.id, include_guardians=True)
        assert reloaded is not None
        return reloaded

    async def update(self, applicant: Applicant) -> Applicant:
        await self._session.flush()
        reloaded = await self.get_by_id(applicant.id, include_guardians=True)
        assert reloaded is not None
        return reloaded

    async def delete(self, applicant: Applicant) -> None:
        await self._session.delete(applicant)
        await self._session.flush()
