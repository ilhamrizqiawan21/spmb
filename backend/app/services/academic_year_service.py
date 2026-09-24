"""Business logic for Academic Year management and active-year lifecycle."""

from uuid import UUID

from app.core.errors import ConflictException, DomainException, NotFoundException
from app.models.academic_year import AcademicYear
from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.schemas.academic_year import AcademicYearCreate, AcademicYearUpdate


class AcademicYearService:
    """Service governing academic year lifecycles and constraints."""

    def __init__(
        self,
        academic_years: AcademicYearRepository,
        admission_periods: AdmissionPeriodRepository,
    ) -> None:
        self._academic_years = academic_years
        self._admission_periods = admission_periods

    async def create(self, data: AcademicYearCreate) -> AcademicYear:
        """Create a new academic year ensuring unique name and single-active rule."""
        if data.start_date >= data.end_date:
            raise DomainException(
                "Start date must be before end date.", code="INVALID_DATE_RANGE"
            )

        if await self._academic_years.get_by_name(data.name) is not None:
            raise ConflictException(
                "Academic year with this name already exists.",
                code="ACADEMIC_YEAR_NAME_TAKEN",
            )

        if data.is_active:
            await self._academic_years.deactivate_all()

        academic_year = AcademicYear(
            name=data.name,
            start_date=data.start_date,
            end_date=data.end_date,
            is_active=data.is_active,
        )
        return await self._academic_years.create(academic_year)

    async def get_by_id(self, id: UUID) -> AcademicYear:
        """Retrieve academic year by ID or raise NotFoundException."""
        academic_year = await self._academic_years.get_by_id(id)
        if academic_year is None:
            raise NotFoundException(
                "Academic year not found.", code="ACADEMIC_YEAR_NOT_FOUND"
            )
        return academic_year

    async def get_active(self) -> AcademicYear | None:
        """Retrieve the currently active academic year, if any."""
        return await self._academic_years.get_active()

    async def list(
        self,
        skip: int = 0,
        limit: int = 50,
        is_active: bool | None = None,
    ) -> tuple[list[AcademicYear], int]:
        """List academic years with optional filtering and pagination."""
        return await self._academic_years.list(skip=skip, limit=limit, is_active=is_active)

    async def update(self, id: UUID, data: AcademicYearUpdate) -> AcademicYear:
        """Update an existing academic year, preserving integrity and active state."""
        academic_year = await self.get_by_id(id)

        if data.name is not None and data.name != academic_year.name:
            if await self._academic_years.get_by_name(data.name) is not None:
                raise ConflictException(
                    "Academic year with this name already exists.",
                    code="ACADEMIC_YEAR_NAME_TAKEN",
                )
            academic_year.name = data.name

        new_start = data.start_date if data.start_date is not None else academic_year.start_date
        new_end = data.end_date if data.end_date is not None else academic_year.end_date
        if new_start >= new_end:
            raise DomainException(
                "Start date must be before end date.", code="INVALID_DATE_RANGE"
            )
        academic_year.start_date = new_start
        academic_year.end_date = new_end

        if data.is_active is True:
            await self._academic_years.deactivate_all(except_id=academic_year.id)
            academic_year.is_active = True
        elif data.is_active is False:
            academic_year.is_active = False

        return await self._academic_years.update(academic_year)

    async def delete(self, id: UUID) -> None:
        """Delete academic year if it has no associated admission periods."""
        academic_year = await self.get_by_id(id)
        period_count = await self._admission_periods.count_by_academic_year(id)
        if period_count > 0:
            raise ConflictException(
                "Cannot delete academic year with existing admission periods.",
                code="ACADEMIC_YEAR_HAS_PERIODS",
            )
        await self._academic_years.delete(academic_year)
