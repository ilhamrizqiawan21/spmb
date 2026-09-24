"""Tests for Registration Availability Service and draft/submission constraints."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import DomainException
from app.core.security import hash_password
from app.core.session import SESSION_COOKIE_NAME, create_session
from app.models.academic_year import AcademicYear
from app.models.admission_period import AdmissionPeriod
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole
from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.schemas.admission_period import AvailabilityStatus
from app.services.registration_availability_service import (
    RegistrationAvailabilityService,
)


async def _create_admin_token(db_session: AsyncSession) -> str:
    result = await db_session.execute(select(Role).where(Role.code == "admission_admin"))
    role = result.scalar_one()

    user = User(
        name="Admin User",
        email=f"{uuid4().hex}@example.com",
        password_hash=hash_password("password123"),
    )
    db_session.add(user)
    await db_session.flush()

    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    return await create_session(user.id)


def _build_test_period(
    academic_year: AcademicYear,
    start_offset_days: int,
    end_offset_days: int,
    is_active: bool = True,
) -> AdmissionPeriod:
    base = datetime.now(UTC)
    start = base + timedelta(days=start_offset_days)
    end = base + timedelta(days=end_offset_days)
    return AdmissionPeriod(
        academic_year_id=academic_year.id,
        name="Gelombang Uji",
        code=f"UJI-{uuid4().hex[:6]}",
        registration_start=start,
        registration_end=end,
        is_active=is_active,
    )


@pytest.mark.asyncio
async def test_availability_before_opening(db_session: AsyncSession) -> None:
    academic_years = AcademicYearRepository(db_session)
    periods = AdmissionPeriodRepository(db_session)
    service = RegistrationAvailabilityService(periods, academic_years)

    ay = AcademicYear(
        name=f"AY-OPEN-{uuid4().hex[:6]}",
        start_date=datetime.now(UTC).date(),
        end_date=(datetime.now(UTC) + timedelta(days=365)).date(),
        is_active=True,
    )
    period = _build_test_period(ay, start_offset_days=5, end_offset_days=30)
    now = datetime.now(UTC)

    status, is_open, reason = service.evaluate_availability(period, ay, now)
    assert status == AvailabilityStatus.BEFORE_OPENING
    assert is_open is False
    assert reason is not None
    assert "not opened yet" in reason

    with pytest.raises(DomainException) as exc_info:
        service.assert_can_create_draft(period, ay, now)
    assert exc_info.value.code == "REGISTRATION_NOT_STARTED"

    with pytest.raises(DomainException) as exc_info:
        service.assert_can_submit(period, ay, now)
    assert exc_info.value.code == "REGISTRATION_NOT_STARTED"


@pytest.mark.asyncio
async def test_availability_during_opening(db_session: AsyncSession) -> None:
    academic_years = AcademicYearRepository(db_session)
    periods = AdmissionPeriodRepository(db_session)
    service = RegistrationAvailabilityService(periods, academic_years)

    ay = AcademicYear(
        name=f"AY-CURR-{uuid4().hex[:6]}",
        start_date=datetime.now(UTC).date(),
        end_date=(datetime.now(UTC) + timedelta(days=365)).date(),
        is_active=True,
    )
    period = _build_test_period(ay, start_offset_days=-5, end_offset_days=10)
    now = datetime.now(UTC)

    status, is_open, reason = service.evaluate_availability(period, ay, now)
    assert status == AvailabilityStatus.OPEN
    assert is_open is True
    assert reason is None

    # Should not raise any exceptions
    service.assert_can_create_draft(period, ay, now)
    service.assert_can_submit(period, ay, now)


@pytest.mark.asyncio
async def test_availability_after_closing(db_session: AsyncSession) -> None:
    academic_years = AcademicYearRepository(db_session)
    periods = AdmissionPeriodRepository(db_session)
    service = RegistrationAvailabilityService(periods, academic_years)

    ay = AcademicYear(
        name=f"AY-CLOSED-{uuid4().hex[:6]}",
        start_date=datetime.now(UTC).date(),
        end_date=(datetime.now(UTC) + timedelta(days=365)).date(),
        is_active=True,
    )
    period = _build_test_period(ay, start_offset_days=-30, end_offset_days=-5)
    now = datetime.now(UTC)

    status, is_open, reason = service.evaluate_availability(period, ay, now)
    assert status == AvailabilityStatus.CLOSED
    assert is_open is False
    assert reason is not None
    assert "Registration closed" in reason

    with pytest.raises(DomainException) as exc_info:
        service.assert_can_create_draft(period, ay, now)
    assert exc_info.value.code == "REGISTRATION_CLOSED"

    with pytest.raises(DomainException) as exc_info:
        service.assert_can_submit(period, ay, now)
    assert exc_info.value.code == "REGISTRATION_CLOSED"


@pytest.mark.asyncio
async def test_availability_inactive_period(db_session: AsyncSession) -> None:
    academic_years = AcademicYearRepository(db_session)
    periods = AdmissionPeriodRepository(db_session)
    service = RegistrationAvailabilityService(periods, academic_years)

    ay = AcademicYear(
        name=f"AY-INACT-P-{uuid4().hex[:6]}",
        start_date=datetime.now(UTC).date(),
        end_date=(datetime.now(UTC) + timedelta(days=365)).date(),
        is_active=True,
    )
    # Window is now, but period is deactivated
    period = _build_test_period(
        ay, start_offset_days=-5, end_offset_days=10, is_active=False
    )
    now = datetime.now(UTC)

    status, is_open, _ = service.evaluate_availability(period, ay, now)
    assert status == AvailabilityStatus.PERIOD_INACTIVE
    assert is_open is False

    with pytest.raises(DomainException) as exc_info:
        service.assert_can_submit(period, ay, now)
    assert exc_info.value.code == "PERIOD_INACTIVE"


@pytest.mark.asyncio
async def test_availability_inactive_academic_year(
    db_session: AsyncSession,
) -> None:
    academic_years = AcademicYearRepository(db_session)
    periods = AdmissionPeriodRepository(db_session)
    service = RegistrationAvailabilityService(periods, academic_years)

    ay = AcademicYear(
        name=f"AY-INACT-{uuid4().hex[:6]}",
        start_date=datetime.now(UTC).date(),
        end_date=(datetime.now(UTC) + timedelta(days=365)).date(),
        is_active=False,
    )
    period = _build_test_period(ay, start_offset_days=-5, end_offset_days=10)
    now = datetime.now(UTC)

    status, is_open, _ = service.evaluate_availability(period, ay, now)
    assert status == AvailabilityStatus.ACADEMIC_YEAR_INACTIVE
    assert is_open is False

    with pytest.raises(DomainException) as exc_info:
        service.assert_can_submit(period, ay, now)
    assert exc_info.value.code == "ACADEMIC_YEAR_INACTIVE"


@pytest.mark.asyncio
async def test_api_availability_and_open_periods_endpoints(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _create_admin_token(db_session)
    client.cookies.set(SESSION_COOKIE_NAME, token)

    # 1. Create active academic year
    ay_res = await client.post(
        "/api/v1/academic-years",
        json={
            "name": f"AY-ACTIVE-{uuid4().hex[:6]}",
            "start_date": "2026-07-01",
            "end_date": "2027-06-30",
            "is_active": True,
        },
    )
    ay_id = ay_res.json()["id"]

    # 2. Create an open period
    now = datetime.now(UTC)
    start_str = (now - timedelta(days=2)).isoformat()
    end_str = (now + timedelta(days=10)).isoformat()

    period_res = await client.post(
        "/api/v1/admission-periods",
        json={
            "academic_year_id": ay_id,
            "name": "Gelombang Buka",
            "code": f"OPEN-{uuid4().hex[:6]}",
            "registration_start": start_str,
            "registration_end": end_str,
            "quota": 50,
            "is_active": True,
        },
    )
    assert period_res.status_code == 201
    period_id = period_res.json()["id"]

    # 3. Query availability endpoint
    avail_res = await client.get(f"/api/v1/admission-periods/{period_id}/availability")
    assert avail_res.status_code == 200
    avail_body = avail_res.json()
    assert avail_body["status"] == "OPEN"
    assert avail_body["is_open"] is True
    assert avail_body["can_create_draft"] is True
    assert avail_body["can_submit"] is True

    # 4. Query public open periods endpoint
    open_res = await client.get("/api/v1/admission-periods/open")
    assert open_res.status_code == 200
    open_items = open_res.json()
    assert any(p["id"] == period_id for p in open_items)

