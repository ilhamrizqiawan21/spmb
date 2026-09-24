"""Tests for Application creation, completion calculation, state machine, and submission (F6)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from django.test import Client
from rest_framework import status

from apps.admission.models import (
    AcademicYear,
    AdmissionPeriod,
    Applicant,
    Application,
    ApplicationStatus,
    GuardianRelationship,
)
from apps.auth.models import Role, User, UserRole


@pytest.fixture
def active_period(db: None) -> AdmissionPeriod:
    ay = AcademicYear.objects.create(
        name="2026/2027",
        start_date=date(2026, 7, 1),
        end_date=date(2027, 6, 30),
        is_active=True,
    )
    now = datetime.now(UTC)
    return AdmissionPeriod.objects.create(
        academic_year=ay,
        name="Gelombang 1",
        code="GEL-1",
        registration_start=now - timedelta(days=1),
        registration_end=now + timedelta(days=30),
        is_active=True,
    )


@pytest.fixture
def parent_user(db: None) -> User:
    user = User.objects.create_user(
        name="Parent User",
        email="parent@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_client(parent_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parent@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def verifier_user(db: None) -> User:
    user = User.objects.create_user(
        name="Verifier User",
        email="verifier@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="verifier")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def verifier_client(verifier_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "verifier@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def applicant(parent_user: User) -> Applicant:
    return Applicant.objects.create(
        owner_user=parent_user,
        full_name="Calon Siswa",
        gender="MALE",
        birth_place="Jakarta",
        birth_date=date(2015, 5, 10),
        address="Jl. Pendidikan No. 10",
        nik="3171234567890001",
        religion="Islam",
    )


@pytest.mark.django_db
def test_create_draft_application(
    parent_client: Client, applicant: Applicant, active_period: AdmissionPeriod
) -> None:
    payload = {
        "applicant_id": str(applicant.id),
        "admission_period_id": str(active_period.id),
    }

    res = parent_client.post(
        "/api/v1/admission/applications", payload, content_type="application/json"
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["status"] == ApplicationStatus.DRAFT
    assert data["registration_number"].startswith("REG-2026-")
    assert data["completion_percentage"] > 0
    assert len(data["status_histories"]) == 1
    assert data["status_histories"][0]["to_status"] == ApplicationStatus.DRAFT


@pytest.mark.django_db
def test_duplicate_application_prevention(
    parent_client: Client, applicant: Applicant, active_period: AdmissionPeriod
) -> None:
    payload = {
        "applicant_id": str(applicant.id),
        "admission_period_id": str(active_period.id),
    }

    res1 = parent_client.post(
        "/api/v1/admission/applications", payload, content_type="application/json"
    )
    assert res1.status_code == status.HTTP_201_CREATED

    res2 = parent_client.post(
        "/api/v1/admission/applications", payload, content_type="application/json"
    )
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in str(res2.json()).lower()


@pytest.mark.django_db
def test_submit_application_validation_and_flow(
    parent_client: Client, applicant: Applicant, active_period: AdmissionPeriod
) -> None:
    # Create draft
    payload = {
        "applicant_id": str(applicant.id),
        "admission_period_id": str(active_period.id),
    }
    res_draft = parent_client.post(
        "/api/v1/admission/applications", payload, content_type="application/json"
    )
    app_id = res_draft.json()["id"]

    # Try submit without guardian -> Should fail 400 Bad Request
    res_sub_fail = parent_client.post(f"/api/v1/admission/applications/{app_id}/submit")
    assert res_sub_fail.status_code == status.HTTP_400_BAD_REQUEST
    assert "without at least one guardian" in str(res_sub_fail.json()).lower()

    # Add guardian
    parent_client.post(
        f"/api/v1/admission/applicants/{applicant.id}/guardians",
        {
            "relationship": GuardianRelationship.FATHER,
            "full_name": "Ayah Calon",
            "phone": "08123456789",
            "is_primary_contact": True,
        },
        content_type="application/json",
    )

    # Submit again -> Should succeed
    res_sub = parent_client.post(f"/api/v1/admission/applications/{app_id}/submit")
    assert res_sub.status_code == status.HTTP_200_OK
    data = res_sub.json()
    assert data["status"] == ApplicationStatus.SUBMITTED
    assert data["submitted_at"] is not None
    assert len(data["status_histories"]) == 2


@pytest.mark.django_db
def test_state_machine_transitions(
    parent_client: Client,
    verifier_client: Client,
    applicant: Applicant,
    active_period: AdmissionPeriod,
) -> None:
    # 1. Create & submit application
    parent_client.post(
        f"/api/v1/admission/applicants/{applicant.id}/guardians",
        {
            "relationship": GuardianRelationship.FATHER,
            "full_name": "Ayah",
            "is_primary_contact": True,
        },
        content_type="application/json",
    )
    res_draft = parent_client.post(
        "/api/v1/admission/applications",
        {
            "applicant_id": str(applicant.id),
            "admission_period_id": str(active_period.id),
        },
        content_type="application/json",
    )
    app_id = res_draft.json()["id"]
    parent_client.post(f"/api/v1/admission/applications/{app_id}/submit")

    # 2. Illegal transition (attempting direct SUBMITTED -> ACCEPTED)
    res_illegal = verifier_client.post(
        f"/api/v1/admission/applications/{app_id}/transition",
        {"to_status": ApplicationStatus.ACCEPTED},
        content_type="application/json",
    )
    assert res_illegal.status_code == status.HTTP_400_BAD_REQUEST

    # 3. Legal transition: SUBMITTED -> UNDER_VERIFICATION
    res_t1 = verifier_client.post(
        f"/api/v1/admission/applications/{app_id}/transition",
        {"to_status": ApplicationStatus.UNDER_VERIFICATION, "reason": "Started verification"},
        content_type="application/json",
    )
    assert res_t1.status_code == status.HTTP_200_OK
    assert res_t1.json()["status"] == ApplicationStatus.UNDER_VERIFICATION

    # 4. Legal transition: UNDER_VERIFICATION -> VERIFIED
    res_t2 = verifier_client.post(
        f"/api/v1/admission/applications/{app_id}/transition",
        {"to_status": ApplicationStatus.VERIFIED, "reason": "All documents verified"},
        content_type="application/json",
    )
    assert res_t2.status_code == status.HTTP_200_OK
    assert res_t2.json()["status"] == ApplicationStatus.VERIFIED
    assert res_t2.json()["verified_at"] is not None

    app_obj = Application.objects.get(pk=app_id)
    assert app_obj.status_histories.count() == 4
