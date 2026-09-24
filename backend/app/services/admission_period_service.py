"""Business logic for Admission Period management."""

from uuid import UUID

from app.core.errors import ConflictException, DomainException, NotFoundException
from app.models.admission_period import AdmissionPeriod
from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.schemas.admission_period import AdmissionPeriodCreate, AdmissionPeriodUpdate


class AdmissionPeriodService:
    """Service governing admission period lifecycles and business rules."""

    def __init__(
        self,
        admission_periods: AdmissionPeriodRepository,
        academic_years: AcademicYearRepository,
    ) -> None:
        self._admission_periods = admission_periods
        self._academic_years = academic_years

    async def create(self, data: AdmissionPeriodCreate) -> AdmissionPeriod:
        """Create a new admission period under an existing academic year."""
        academic_year = await self._academic_years.get_by_id(data.academic_year_id)
        if academic_year is None:
            raise NotFoundException(
                "Referenced academic year does not exist.",
                code="ACADEMIC_YEAR_NOT_FOUND",
            )

        if data.registration_start >= data.registration_end:
            raise DomainException(
                "Registration start must be before registration end.",
                code="INVALID_DATE_RANGE",
            )
        if data.announcement_at is not None and data.announcement_at < data.registration_end:
            raise DomainException(
                "Announcement date cannot be earlier than registration end.",
                code="INVALID_ANNOUNCEMENT_DATE",
            )
        if data.quota is not None and data.quota < 0:
            raise DomainException(
                "Quota must be non-negative.",
                code="INVALID_QUOTA",
            )

        existing = await self._admission_periods.get_by_code(
            data.code, data.academic_year_id
        )
        if existing is not None:
            raise ConflictException(
                "Admission period code already exists in this academic year.",
                code="ADMISSION_PERIOD_CODE_TAKEN",
            )

        period = AdmissionPeriod(
            academic_year_id=data.academic_year_id,
            name=data.name,
            code=data.code,
            registration_start=data.registration_start,
            registration_end=data.registration_end,
            announcement_at=data.announcement_at,
            quota=data.quota,
            is_active=data.is_active,
            settings=data.settings,
        )
        return await self._admission_periods.create(period)

    async def get_by_id(self, id: UUID) -> AdmissionPeriod:
        """Retrieve admission period by ID or raise NotFoundException."""
        period = await self._admission_periods.get_by_id(id)
        if period is None:
            raise NotFoundException(
                "Admission period not found.",
                code="ADMISSION_PERIOD_NOT_FOUND",
            )
        return period

    async def list(
        self,
        academic_year_id: UUID | None = None,
        is_active: bool | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[AdmissionPeriod], int]:
        """List admission periods with optional filters and pagination."""
        return await self._admission_periods.list(
            academic_year_id=academic_year_id,
            is_active=is_active,
            skip=skip,
            limit=limit,
        )

    async def update(self, id: UUID, data: AdmissionPeriodUpdate) -> AdmissionPeriod:
        """Update admission period attributes while verifying constraints."""
        period = await self.get_by_id(id)

        if data.code is not None and data.code != period.code:
            existing = await self._admission_periods.get_by_code(
                data.code, period.academic_year_id
            )
            if existing is not None:
                raise ConflictException(
                    "Admission period code already exists in this academic year.",
                    code="ADMISSION_PERIOD_CODE_TAKEN",
                )
            period.code = data.code

        new_start = (
            data.registration_start
            if data.registration_start is not None
            else period.registration_start
        )
        new_end = (
            data.registration_end
            if data.registration_end is not None
            else period.registration_end
        )

        if new_start >= new_end:
            raise DomainException(
                "Registration start must be before registration end.",
                code="INVALID_DATE_RANGE",
            )

        new_announcement = (
            data.announcement_at
            if "announcement_at" in data.model_fields_set
            else period.announcement_at
        )
        if new_announcement is not None and new_announcement < new_end:
            raise DomainException(
                "Announcement date cannot be earlier than registration end.",
                code="INVALID_ANNOUNCEMENT_DATE",
            )

        period.registration_start = new_start
        period.registration_end = new_end
        if "announcement_at" in data.model_fields_set:
            period.announcement_at = data.announcement_at

        if data.name is not None:
            period.name = data.name

        if "quota" in data.model_fields_set:
            if data.quota is not None and data.quota < 0:
                raise DomainException("Quota must be non-negative.", code="INVALID_QUOTA")
            period.quota = data.quota

        if data.is_active is not None:
            period.is_active = data.is_active

        if "settings" in data.model_fields_set:
            period.settings = data.settings

        return await self._admission_periods.update(period)

    async def delete(self, id: UUID) -> None:
        """Delete an admission period."""
        period = await self.get_by_id(id)
        await self._admission_periods.delete(period)
