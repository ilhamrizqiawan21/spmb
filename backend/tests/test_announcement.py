"""Tests for Announcement & Result Publication (F11)."""

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
        registration_end=now - timedelta(days=1),
        is_active=True,
    )


@pytest.fixture
def parent_user_a(db: None) -> User:
    user = User.objects.create_user(
        name="Orang Tua A",
        email="parent.a@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_user_b(db: None) -> User:
    user = User.objects.create_user(
        name="Orang Tua B",
        email="parent.b@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin Pengumuman",
        email="admin.announcement@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="super_admin")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_client_a(parent_user_a: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parent.a@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def parent_client_b(parent_user_b: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parent.b@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin.announcement@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def assessed_application_a(
    active_period: AdmissionPeriod, parent_user_a: User
) -> Application:
    applicant = Applicant.objects.create(
        owner_user=parent_user_a,
        full_name="Ahmad Student A",
        gender="MALE",
        birth_date=date(2015, 8, 15),
        birth_place="Jakarta",
        religion="ISLAM",
        address="Jl. Merdeka No. 10",
    )
    applicant.guardians.create(
        relationship=GuardianRelationship.FATHER,
        full_name="Ayah Ahmad",
        phone="081111111111",
        address="Jl. Merdeka No. 10",
        is_primary_contact=True,
    )
    return Application.objects.create(
        applicant=applicant,
        admission_period=active_period,
        registration_number="REG-2027-ANN01",
        status=ApplicationStatus.ASSESSED,
        submitted_at=datetime.now(UTC) - timedelta(days=5),
        current_step=5,
        completion_percentage=100,
    )


@pytest.mark.django_db
def test_decision_privacy_before_and_after_publication(
    admin_user: User,
    admin_client: Client,
    parent_client_a: Client,
    active_period: AdmissionPeriod,
    assessed_application_a: Application,
):
    # 1. Admin sets decision to ACCEPTED
    decision = DecisionService.make_decision(
        user=admin_user,
        application_id=assessed_application_a.id,
        decision="ACCEPTED",
        reason="Memenuhi syarat akademik",
    )
    # Ensure decision is not published yet
    decision.published_at = None
    decision.save()

    # 2. Parent checks result BEFORE publication -> Private / Not Published
    res_before = parent_client_a.get(
        f"/api/v1/selection/applications/{assessed_application_a.id}/announcement"
    )
    assert res_before.status_code == status.HTTP_200_OK
    assert res_before.json()["is_published"] is False
    assert "belum diumumkan" in res_before.json()["message"]

    # 3. Admin bulk publishes announcements for the period
    res_pub = admin_client.post(
        f"/api/v1/selection/periods/{active_period.id}/publish-announcement",
        {},
        content_type="application/json",
    )
    assert res_pub.status_code == status.HTTP_200_OK
    assert res_pub.json()["published_count"] >= 1

    # 4. Parent checks result AFTER publication -> Access Granted
    res_after = parent_client_a.get(
        f"/api/v1/selection/applications/{assessed_application_a.id}/announcement"
    )
    assert res_after.status_code == status.HTTP_200_OK
    data = res_after.json()
    assert data["is_published"] is True
    assert data["decision"] == "ACCEPTED"
    assert len(data["next_steps"]) > 0


@pytest.mark.django_db
def test_unauthorized_parent_announcement_access(
    admin_user: User,
    admin_client: Client,
    parent_client_b: Client,
    active_period: AdmissionPeriod,
    assessed_application_a: Application,
):
    DecisionService.make_decision(
        user=admin_user,
        application_id=assessed_application_a.id,
        decision="ACCEPTED",
        reason="Diterima",
    )
    admin_client.post(
        f"/api/v1/selection/periods/{active_period.id}/publish-announcement",
        {},
        content_type="application/json",
    )

    # Parent B tries to access Parent A's child decision -> 403 Forbidden
    res = parent_client_b.get(
        f"/api/v1/selection/applications/{assessed_application_a.id}/announcement"
    )
    assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_public_lookup_announcement(
    admin_user: User,
    admin_client: Client,
    active_period: AdmissionPeriod,
    assessed_application_a: Application,
):
    DecisionService.make_decision(
        user=admin_user,
        application_id=assessed_application_a.id,
        decision="WAITLISTED",
        reason="Daftar Tunggu",
    )
    admin_client.post(
        f"/api/v1/selection/periods/{active_period.id}/publish-announcement",
        {},
        content_type="application/json",
    )

    anon_client = Client()

    # 1. Valid lookup
    res_valid = anon_client.post(
        "/api/v1/selection/announcements/lookup",
        {
            "registration_number": "REG-2027-ANN01",
            "birth_date": "2015-08-15",
        },
        content_type="application/json",
    )
    assert res_valid.status_code == status.HTTP_200_OK
    data = res_valid.json()
    assert data["is_published"] is True
    assert data["decision"] == "WAITLISTED"
    assert "A***d" in data["applicant_name_masked"]

    # 2. Invalid birth date lookup -> 400 Bad Request
    res_invalid = anon_client.post(
        "/api/v1/selection/announcements/lookup",
        {
            "registration_number": "REG-2027-ANN01",
            "birth_date": "2010-01-01",
        },
        content_type="application/json",
    )
    assert res_invalid.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_result_letter_pdf_download(
    admin_user: User,
    admin_client: Client,
    parent_client_a: Client,
    active_period: AdmissionPeriod,
    assessed_application_a: Application,
):
    DecisionService.make_decision(
        user=admin_user,
        application_id=assessed_application_a.id,
        decision="ACCEPTED",
        reason="Disetujui",
    )
    admin_client.post(
        f"/api/v1/selection/periods/{active_period.id}/publish-announcement",
        {},
        content_type="application/json",
    )

    res = parent_client_a.get(
        f"/api/v1/selection/applications/{assessed_application_a.id}/announcement/letter"
    )
    assert res.status_code == status.HTTP_200_OK
    assert res["Content-Type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-1.4")
