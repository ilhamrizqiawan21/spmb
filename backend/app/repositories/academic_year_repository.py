"""Data access for the ``academic_years`` table."""

import builtins
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.academic_year import AcademicYear

_WITH_PERIODS = selectinload(AcademicYear.admission_periods)


class AcademicYearRepository:
    """Encapsulates all persistence access for :class:`AcademicYear`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, id: UUID, include_periods: bool = False) -> AcademicYear | None:
        query = select(AcademicYear).where(AcademicYear.id == id)
        if include_periods:
            query = query.options(_WITH_PERIODS)
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> AcademicYear | None:
        result = await self._session.execute(
            select(AcademicYear).where(AcademicYear.name == name)
        )
        return result.scalar_one_or_none()

    async def get_active(self, include_periods: bool = False) -> AcademicYear | None:
        query = select(AcademicYear).where(AcademicYear.is_active.is_(True))
        if include_periods:
            query = query.options(_WITH_PERIODS)
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def list(
        self,
        skip: int = 0,
        limit: int = 50,
        is_active: bool | None = None,
    ) -> tuple[builtins.list[AcademicYear], int]:
        query = select(AcademicYear)
        count_query = select(func.count(AcademicYear.id))
        if is_active is not None:
            query = query.where(AcademicYear.is_active == is_active)
            count_query = count_query.where(AcademicYear.is_active == is_active)

        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        items_result = await self._session.execute(
            query.order_by(AcademicYear.start_date.desc()).offset(skip).limit(limit)
        )
        items = list(items_result.scalars().all())
        return items, total

    async def create(self, academic_year: AcademicYear) -> AcademicYear:
        self._session.add(academic_year)
        await self._session.flush()
        await self._session.refresh(academic_year)
        return academic_year

    async def update(self, academic_year: AcademicYear) -> AcademicYear:
        await self._session.flush()
        await self._session.refresh(academic_year)
        return academic_year

    async def delete(self, academic_year: AcademicYear) -> None:
        await self._session.delete(academic_year)
        await self._session.flush()

    async def deactivate_all(self, except_id: UUID | None = None) -> None:
        """Deactivate all active academic years, optionally preserving one."""
        stmt = update(AcademicYear).where(AcademicYear.is_active.is_(True))
        if except_id is not None:
            stmt = stmt.where(AcademicYear.id != except_id)
        stmt = stmt.values(is_active=False)
        await self._session.execute(stmt)
        await self._session.flush()
