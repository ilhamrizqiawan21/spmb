"""Tests for Re-registration Workflow (F12)."""

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
from apps.enrollment.models import (
    ReRegistrationRequirement,
    ReRegistrationStatus,
)
from apps.selection.services import DecisionService


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
        registration_start=now - timedelta(days=10),
        registration_end=now + timedelta(days=1),
        is_active=True,
    )


@pytest.fixture
def parent_user(db: None) -> User:
    user = User.objects.create_user(
        name="Parent ReReg",
        email="parent.rereg@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin ReReg",
        email="admin.rereg@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="super_admin")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_client(parent_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parent.rereg@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin.rereg@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def accepted_application(
    active_period: AdmissionPeriod, parent_user: User, admin_user: User
) -> Application:
    applicant = Applicant.objects.create(
        owner_user=parent_user,
        full_name="Budi Daftar Ulang",
        gender="MALE",
        birth_date=date(2015, 3, 20),
        birth_place="Bandung",
        religion="ISLAM",
        address="Jl. Al-Ihsan No. 50",
    )
    applicant.guardians.create(
        relationship=GuardianRelationship.FATHER,
        full_name="Ayah Budi",
        phone="081299998888",
        address="Jl. Al-Ihsan No. 50",
        is_primary_contact=True,
    )
    app = Application.objects.create(
        applicant=applicant,
        admission_period=active_period,
        registration_number="REG-2027-REREG01",
        status=ApplicationStatus.ASSESSED,
        submitted_at=datetime.now(UTC),
        current_step=5,
        completion_percentage=100,
    )
    # Make ACCEPTED decision
    DecisionService.make_decision(
        user=admin_user,
        application_id=app.id,
        decision="ACCEPTED",
        reason="Diterima untuk daftar ulang",
    )
    app.refresh_from_db()
    return app


@pytest.mark.django_db
def test_re_registration_requirement_crud(
    admin_client: Client, active_period: AdmissionPeriod
):
    # 1. Create requirement
    res_create = admin_client.post(
        "/api/v1/enrollment/requirements",
        {
            "admission_period_id": str(active_period.id),
            "name": "Surat Pernyataan Orang Tua",
            "code": "SURAT_PERNYATAAN",
            "is_required": True,
            "sort_order": 1,
        },
        content_type="application/json",
    )
    assert res_create.status_code == status.HTTP_201_CREATED
    req_id = res_create.json()["id"]

    # 2. List requirements
    res_list = admin_client.get(
        f"/api/v1/enrollment/requirements?admission_period_id={active_period.id}"
    )
    assert res_list.status_code == status.HTTP_200_OK
    assert len(res_list.json()) == 1

    # 3. Update requirement
    res_update = admin_client.patch(
        f"/api/v1/enrollment/requirements/{req_id}",
        {"name": "Surat Pernyataan Kesediaan"},
        content_type="application/json",
    )
    assert res_update.status_code == status.HTTP_200_OK
    assert res_update.json()["name"] == "Surat Pernyataan Kesediaan"


@pytest.mark.django_db
def test_start_re_registration_validation_and_seeding(
    admin_client: Client,
    parent_client: Client,
    active_period: AdmissionPeriod,
    accepted_application: Application,
):
    # 1. Create 2 requirements for period
    ReRegistrationRequirement.objects.create(
        admission_period=active_period,
        name="Surat Pernyataan Tata Tertib",
        code="TATA_TERTIB",
        is_required=True,
        sort_order=1,
    )
    ReRegistrationRequirement.objects.create(
        admission_period=active_period,
        name="Ukuran Seragam",
        code="SERAGAM",
        is_required=False,
        sort_order=2,
    )

    # 2. Start re-registration
    res_start = parent_client.post(
        f"/api/v1/enrollment/applications/{accepted_application.id}/start-re-registration",
        {},
        content_type="application/json",
    )
    assert res_start.status_code == status.HTTP_201_CREATED
    data = res_start.json()
    assert data["status"] == ReRegistrationStatus.IN_PROGRESS
    assert len(data["items"]) == 2

    accepted_application.refresh_from_db()
    assert accepted_application.status == ApplicationStatus.RE_REGISTRATION


@pytest.mark.django_db
def test_re_registration_item_update_and_completion(
    parent_client: Client,
    active_period: AdmissionPeriod,
    accepted_application: Application,
):
    ReRegistrationRequirement.objects.create(
        admission_period=active_period,
        name="Surat Pernyataan",
        code="SURAT_PERNYATAAN",
        is_required=True,
        sort_order=1,
    )

    # Start re-registration
    res_start = parent_client.post(
        f"/api/v1/enrollment/applications/{accepted_application.id}/start-re-registration",
        {},
        content_type="application/json",
    )
    re_reg_id = res_start.json()["id"]
    item_id = res_start.json()["items"][0]["id"]

    # Try complete before completing mandatory item -> fails 400
    res_err = parent_client.post(
        f"/api/v1/enrollment/re-registrations/{re_reg_id}/complete",
        {},
        content_type="application/json",
    )
    assert res_err.status_code == status.HTTP_400_BAD_REQUEST
    assert "mandatory items incomplete" in str(res_err.json())

    # Update item to COMPLETED
    res_item = parent_client.patch(
        f"/api/v1/enrollment/re-registration-items/{item_id}",
        {"status": "COMPLETED", "notes": "Sudah diisi dan ditandatangani"},
        content_type="application/json",
    )
    assert res_item.status_code == status.HTTP_200_OK
    assert res_item.json()["status"] == "COMPLETED"

    # Complete re-registration
    res_comp = parent_client.post(
        f"/api/v1/enrollment/re-registrations/{re_reg_id}/complete",
        {},
        content_type="application/json",
    )
    assert res_comp.status_code == status.HTTP_200_OK
    assert res_comp.json()["status"] == ReRegistrationStatus.COMPLETED

    accepted_application.refresh_from_db()
    assert accepted_application.status == ApplicationStatus.RE_REGISTRATION_VERIFIED


@pytest.mark.django_db
def test_non_accepted_application_cannot_start_re_registration(
    parent_client: Client,
    active_period: AdmissionPeriod,
    parent_user: User,
):
    draft_app = Application.objects.create(
        applicant=Applicant.objects.create(
            owner_user=parent_user,
            full_name="Child Draft",
            birth_date=date(2015, 1, 1),
            address="Street",
        ),
        admission_period=active_period,
        registration_number="REG-DRAFT",
        status=ApplicationStatus.DRAFT,
    )

    res = parent_client.post(
        f"/api/v1/enrollment/applications/{draft_app.id}/start-re-registration",
        {},
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Only ACCEPTED applications" in str(res.json())
