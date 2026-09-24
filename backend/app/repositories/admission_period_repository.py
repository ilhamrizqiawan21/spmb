"""Data access for the ``admission_periods`` table."""

import builtins
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.admission_period import AdmissionPeriod

_WITH_ACADEMIC_YEAR = selectinload(AdmissionPeriod.academic_year)


class AdmissionPeriodRepository:
    """Encapsulates all persistence access for :class:`AdmissionPeriod`."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(
        self, id: UUID, include_academic_year: bool = False
    ) -> AdmissionPeriod | None:
        query = select(AdmissionPeriod).where(AdmissionPeriod.id == id)
        if include_academic_year:
            query = query.options(_WITH_ACADEMIC_YEAR)
        result = await self._session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_code(
        self, code: str, academic_year_id: UUID
    ) -> AdmissionPeriod | None:
        result = await self._session.execute(
            select(AdmissionPeriod).where(
                AdmissionPeriod.code == code,
                AdmissionPeriod.academic_year_id == academic_year_id,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        academic_year_id: UUID | None = None,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 50,
        include_academic_year: bool = False,
    ) -> tuple[builtins.list[AdmissionPeriod], int]:
        query = select(AdmissionPeriod)
        count_query = select(func.count(AdmissionPeriod.id))

        if academic_year_id is not None:
            query = query.where(AdmissionPeriod.academic_year_id == academic_year_id)
            count_query = count_query.where(AdmissionPeriod.academic_year_id == academic_year_id)
        if is_active is not None:
            query = query.where(AdmissionPeriod.is_active == is_active)
            count_query = count_query.where(AdmissionPeriod.is_active == is_active)

        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        if include_academic_year:
            query = query.options(_WITH_ACADEMIC_YEAR)

        items_result = await self._session.execute(
            query.order_by(AdmissionPeriod.registration_start.asc()).offset(skip).limit(limit)
        )
        items = list(items_result.scalars().all())
        return items, total

    async def get_open_periods(
        self, now: datetime, academic_year_id: UUID | None = None
    ) -> builtins.list[AdmissionPeriod]:
        """Find active admission periods whose registration dates encompass ``now``."""
        query = (
            select(AdmissionPeriod)
            .options(_WITH_ACADEMIC_YEAR)
            .where(
                AdmissionPeriod.is_active.is_(True),
                AdmissionPeriod.registration_start <= now,
                AdmissionPeriod.registration_end >= now,
            )
        )
        if academic_year_id is not None:
            query = query.where(AdmissionPeriod.academic_year_id == academic_year_id)

        result = await self._session.execute(
            query.order_by(AdmissionPeriod.registration_start.asc())
        )
        return list(result.scalars().all())

    async def count_by_academic_year(self, academic_year_id: UUID) -> int:
        result = await self._session.execute(
            select(func.count(AdmissionPeriod.id)).where(
                AdmissionPeriod.academic_year_id == academic_year_id
            )
        )
        return result.scalar_one()

    async def create(self, period: AdmissionPeriod) -> AdmissionPeriod:
        self._session.add(period)
        await self._session.flush()
        await self._session.refresh(period)
        return period

    async def update(self, period: AdmissionPeriod) -> AdmissionPeriod:
        await self._session.flush()
        await self._session.refresh(period)
        return period

    async def delete(self, period: AdmissionPeriod) -> None:
        await self._session.delete(period)
        await self._session.flush()
