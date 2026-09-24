"""Service determining registration availability and draft/submission eligibility."""

from datetime import UTC, datetime
from uuid import UUID

from app.core.errors import DomainException, NotFoundException
from app.models.academic_year import AcademicYear
from app.models.admission_period import AdmissionPeriod
from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.schemas.admission_period import (
    AdmissionPeriodAvailabilityResponse,
    AvailabilityStatus,
)


class RegistrationAvailabilityService:
    """Evaluates whether registration is currently open and guards submissions."""

    def __init__(
        self,
        admission_periods: AdmissionPeriodRepository,
        academic_years: AcademicYearRepository,
    ) -> None:
        self._admission_periods = admission_periods
        self._academic_years = academic_years

    def evaluate_availability(
        self,
        period: AdmissionPeriod,
        academic_year: AcademicYear | None = None,
        now: datetime | None = None,
    ) -> tuple[AvailabilityStatus, bool, str | None]:
        """Determine lifecycle availability status, is_open flag, and descriptive reason."""
        current_time = now or datetime.now(UTC)

        # 1. Academic year active check
        if academic_year is not None and not academic_year.is_active:
            return (
                AvailabilityStatus.ACADEMIC_YEAR_INACTIVE,
                False,
                "The associated academic year is inactive.",
            )

        # 2. Admission period active check
        if not period.is_active:
            return (
                AvailabilityStatus.PERIOD_INACTIVE,
                False,
                "The admission period is currently inactive.",
            )

        # 3. Before opening window
        if current_time < period.registration_start:
            return (
                AvailabilityStatus.BEFORE_OPENING,
                False,
                "Registration has not opened yet. It will open at "
                f"{period.registration_start.isoformat()}.",
            )

        # 4. After closing window
        if current_time > period.registration_end:
            return (
                AvailabilityStatus.CLOSED,
                False,
                f"Registration closed at {period.registration_end.isoformat()}.",
            )

        # 5. Open window
        return (AvailabilityStatus.OPEN, True, None)

    async def get_period_availability(
        self,
        period_id: UUID,
        now: datetime | None = None,
    ) -> AdmissionPeriodAvailabilityResponse:
        """Fetch period, evaluate availability, and construct response."""
        period = await self._admission_periods.get_by_id(period_id, include_academic_year=True)
        if period is None:
            raise NotFoundException(
                "Admission period not found.", code="ADMISSION_PERIOD_NOT_FOUND"
            )

        current_time = now or datetime.now(UTC)
        status, is_open, reason = self.evaluate_availability(
            period=period,
            academic_year=period.academic_year,
            now=current_time,
        )

        can_create_draft = is_open
        can_submit = is_open

        return AdmissionPeriodAvailabilityResponse(
            period_id=period.id,
            status=status,
            is_open=is_open,
            can_create_draft=can_create_draft,
            can_submit=can_submit,
            registration_start=period.registration_start,
            registration_end=period.registration_end,
            server_time=current_time,
            quota=period.quota,
            reason=reason,
        )

    def assert_can_create_draft(
        self,
        period: AdmissionPeriod,
        academic_year: AcademicYear | None = None,
        now: datetime | None = None,
    ) -> None:
        """Reject new application draft initialization if registration is not open."""
        status, is_open, reason = self.evaluate_availability(
            period=period,
            academic_year=academic_year,
            now=now,
        )
        if not is_open:
            match status:
                case AvailabilityStatus.ACADEMIC_YEAR_INACTIVE:
                    raise DomainException(
                        "Cannot start draft: Academic year is not active.",
                        code="ACADEMIC_YEAR_INACTIVE",
                    )
                case AvailabilityStatus.PERIOD_INACTIVE:
                    raise DomainException(
                        "Cannot start draft: Admission period is not active.",
                        code="PERIOD_INACTIVE",
                    )
                case AvailabilityStatus.BEFORE_OPENING:
                    raise DomainException(
                        "Cannot start draft: Registration period has not started yet.",
                        code="REGISTRATION_NOT_STARTED",
                    )
                case AvailabilityStatus.CLOSED:
                    raise DomainException(
                        "Cannot start draft: Registration period has closed.",
                        code="REGISTRATION_CLOSED",
                    )
                case _:
                    raise DomainException(
                        f"Cannot start draft: {reason or 'Registration unavailable.'}",
                        code="REGISTRATION_UNAVAILABLE",
                    )

    def assert_can_submit(
        self,
        period: AdmissionPeriod,
        academic_year: AcademicYear | None = None,
        now: datetime | None = None,
    ) -> None:
        """Reject application submission outside allowed registration window."""
        status, is_open, reason = self.evaluate_availability(
            period=period,
            academic_year=academic_year,
            now=now,
        )
        if not is_open:
            match status:
                case AvailabilityStatus.ACADEMIC_YEAR_INACTIVE:
                    raise DomainException(
                        "Cannot submit application: Academic year is not active.",
                        code="ACADEMIC_YEAR_INACTIVE",
                    )
                case AvailabilityStatus.PERIOD_INACTIVE:
                    raise DomainException(
                        "Cannot submit application: Admission period is not active.",
                        code="PERIOD_INACTIVE",
                    )
                case AvailabilityStatus.BEFORE_OPENING:
                    raise DomainException(
                        "Cannot submit application: Registration period has not opened yet.",
                        code="REGISTRATION_NOT_STARTED",
                    )
                case AvailabilityStatus.CLOSED:
                    raise DomainException(
                        "Cannot submit application: Registration period has closed.",
                        code="REGISTRATION_CLOSED",
                    )
                case _:
                    raise DomainException(
                        f"Cannot submit application: {reason or 'Registration unavailable.'}",
                        code="REGISTRATION_UNAVAILABLE",
                    )

    async def get_open_periods(
        self, now: datetime | None = None
    ) -> list[AdmissionPeriod]:
        """Return all periods currently open under the active academic year."""
        current_time = now or datetime.now(UTC)
        active_year = await self._academic_years.get_active()
        if active_year is None:
            return []

        return await self._admission_periods.get_open_periods(
            now=current_time,
            academic_year_id=active_year.id,
        )
