"""Tests for Academic Year, Admission Period, and Registration Availability (F4)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from django.test import Client
from rest_framework import status

from apps.admission.models import AcademicYear, AdmissionPeriod
from apps.admission.serializers import AvailabilityStatus
from apps.admission.services import RegistrationAvailabilityService
from apps.auth.models import Role, User, UserRole


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin User",
        email="admin@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="admission_admin")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.mark.django_db
def test_academic_year_crud_and_single_active_rule(admin_client: Client) -> None:
    # 1. Create first academic year as active
    payload1 = {
        "name": "2026/2027",
        "start_date": "2026-07-01",
        "end_date": "2027-06-30",
        "is_active": True,
    }
    res1 = admin_client.post(
        "/api/v1/admission/academic-years", payload1, content_type="application/json"
    )
    assert res1.status_code == status.HTTP_201_CREATED
    ay1_id = res1.json()["id"]

    ay1 = AcademicYear.objects.get(pk=ay1_id)
    assert ay1.is_active is True

    # 2. Create second academic year as active -> ay1 must be automatically deactivated
    payload2 = {
        "name": "2027/2028",
        "start_date": "2027-07-01",
        "end_date": "2028-06-30",
        "is_active": True,
    }
    res2 = admin_client.post(
        "/api/v1/admission/academic-years", payload2, content_type="application/json"
    )
    assert res2.status_code == status.HTTP_201_CREATED
    ay2_id = res2.json()["id"]

    ay1.refresh_from_db()
    ay2 = AcademicYear.objects.get(pk=ay2_id)
    assert ay1.is_active is False
    assert ay2.is_active is True

    # 3. Invalid date range (start >= end)
    invalid_payload = {
        "name": "Invalid AY",
        "start_date": "2027-07-01",
        "end_date": "2026-06-30",
        "is_active": False,
    }
    res_inv = admin_client.post(
        "/api/v1/admission/academic-years", invalid_payload, content_type="application/json"
    )
    assert res_inv.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_academic_year_delete_restriction_when_has_periods(admin_client: Client) -> None:
    ay = AcademicYear.objects.create(
        name="2026/2027",
        start_date=date(2026, 7, 1),
        end_date=date(2027, 6, 30),
        is_active=True,
    )
    AdmissionPeriod.objects.create(
        academic_year=ay,
        name="Gelombang 1",
        code="GEL-1",
        registration_start=datetime(2026, 8, 1, 0, 0, tzinfo=UTC),
        registration_end=datetime(2026, 8, 31, 23, 59, tzinfo=UTC),
    )

    del_res = admin_client.delete(f"/api/v1/admission/academic-years/{ay.id}")
    assert del_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "existing admission periods" in str(del_res.json()).lower()


@pytest.mark.django_db
def test_admission_period_crud_and_validation(admin_client: Client) -> None:
    ay = AcademicYear.objects.create(
        name="2026/2027",
        start_date=date(2026, 7, 1),
        end_date=date(2027, 6, 30),
        is_active=True,
    )

    payload = {
        "academic_year_id": str(ay.id),
        "name": "Gelombang 1",
        "code": "GEL-1",
        "registration_start": "2026-08-01T00:00:00Z",
        "registration_end": "2026-08-31T23:59:59Z",
        "announcement_at": "2026-09-05T10:00:00Z",
        "quota": 100,
        "is_active": True,
    }
    res = admin_client.post("/api/v1/admission/periods", payload, content_type="application/json")
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["code"] == "GEL-1"
    assert data["quota"] == 100

    # Test duplicate code in same AY
    res_dup = admin_client.post(
        "/api/v1/admission/periods", payload, content_type="application/json"
    )
    assert res_dup.status_code == status.HTTP_400_BAD_REQUEST

    # Test invalid announcement date (before registration end)
    invalid_announcement_payload = dict(payload)
    invalid_announcement_payload["code"] = "GEL-2"
    invalid_announcement_payload["announcement_at"] = "2026-08-15T00:00:00Z"
    res_ann = admin_client.post(
        "/api/v1/admission/periods",
        invalid_announcement_payload,
        content_type="application/json",
    )
    assert res_ann.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_registration_availability_service_window_evaluation() -> None:
    ay = AcademicYear.objects.create(
        name="2026/2027",
        start_date=date(2026, 7, 1),
        end_date=date(2027, 6, 30),
        is_active=True,
    )
    start = datetime(2026, 8, 1, 0, 0, tzinfo=UTC)
    end = datetime(2026, 8, 31, 23, 59, tzinfo=UTC)

    period = AdmissionPeriod.objects.create(
        academic_year=ay,
        name="Gelombang 1",
        code="GEL-1",
        registration_start=start,
        registration_end=end,
        is_active=True,
    )

    # 1. Before opening
    t_before = start - timedelta(days=1)
    st1, is_open1, _ = RegistrationAvailabilityService.evaluate_availability(
        period, ay, now=t_before
    )
    assert st1 == AvailabilityStatus.BEFORE_OPENING
    assert is_open1 is False

    # 2. Open window
    t_during = start + timedelta(days=10)
    st2, is_open2, _ = RegistrationAvailabilityService.evaluate_availability(
        period, ay, now=t_during
    )
    assert st2 == AvailabilityStatus.OPEN
    assert is_open2 is True

    # 3. Closed window
    t_after = end + timedelta(days=1)
    st3, is_open3, _ = RegistrationAvailabilityService.evaluate_availability(
        period, ay, now=t_after
    )
    assert st3 == AvailabilityStatus.CLOSED
    assert is_open3 is False

    # 4. Period inactive
    period.is_active = False
    period.save()
    st4, is_open4, _ = RegistrationAvailabilityService.evaluate_availability(
        period, ay, now=t_during
    )
    assert st4 == AvailabilityStatus.PERIOD_INACTIVE
    assert is_open4 is False

    # 5. Academic year inactive
    period.is_active = True
    ay.is_active = False
    st5, is_open5, _ = RegistrationAvailabilityService.evaluate_availability(
        period, ay, now=t_during
    )
    assert st5 == AvailabilityStatus.ACADEMIC_YEAR_INACTIVE
    assert is_open5 is False
