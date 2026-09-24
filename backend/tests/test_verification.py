"""Tests for Verification Center work queue, assignments, and verification reviews (F8)."""

from datetime import UTC, date, datetime, timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from rest_framework import status

from apps.admission.models import (
    AcademicYear,
    AdmissionPeriod,
    Applicant,
    Application,
    ApplicationStatus,
    DocumentRequirement,
    GuardianRelationship,
)
from apps.admission.services import DocumentService
from apps.auth.models import Role, User, UserRole
from apps.verification.models import (
    VerificationReviewStatus,
)


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
        name="Parent Verif Test",
        email="parent.verif@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def verifier_user(db: None) -> User:
    user = User.objects.create_user(
        name="Verifier One",
        email="verifier1.test@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="verifier")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin Verif",
        email="admin.verif@example.test",
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
        {"identifier": "parent.verif@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def verifier_client(verifier_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "verifier1.test@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin.verif@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def document_requirement(active_period: AdmissionPeriod) -> DocumentRequirement:
    return DocumentRequirement.objects.create(
        admission_period=active_period,
        name="Kartu Keluarga",
        code="KK",
        is_required=True,
        allowed_mime_types=["application/pdf"],
        max_file_size_bytes=5 * 1024 * 1024,
    )


@pytest.fixture
def submitted_application(parent_user: User, active_period: AdmissionPeriod) -> Application:
    applicant = Applicant.objects.create(
        owner_user=parent_user,
        full_name="Ahmad Verifikasi",
        gender="MALE",
        birth_date=date(2015, 5, 10),
        birth_place="Bandung",
        religion="ISLAM",
        address="Jl. Pesantren No. 10",
    )
    applicant.guardians.create(
        relationship=GuardianRelationship.FATHER,
        full_name="Ayah Ahmad",
        phone="081987654321",
        address="Jl. Pesantren No. 10",
        is_primary_contact=True,
    )
    return Application.objects.create(
        applicant=applicant,
        admission_period=active_period,
        registration_number="REG-2027-VERIF01",
        status=ApplicationStatus.SUBMITTED,
        submitted_at=datetime.now(UTC),
        current_step=5,
        completion_percentage=100,
    )


@pytest.mark.django_db
def test_verification_assignment(
    admin_client: Client,
    verifier_user: User,
    submitted_application: Application,
):
    response = admin_client.post(
        "/api/v1/verification/assignments",
        {
            "application_id": str(submitted_application.id),
            "verifier_id": str(verifier_user.id),
        },
        content_type="application/json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["verifier_id"] == str(verifier_user.id)
    assert data["application_id"] == str(submitted_application.id)

    submitted_application.refresh_from_db()
    assert submitted_application.status == ApplicationStatus.UNDER_VERIFICATION


@pytest.mark.django_db
def test_verifier_queue_filtering(
    verifier_client: Client,
    admin_client: Client,
    verifier_user: User,
    submitted_application: Application,
):
    # 1. Queue list as verifier (unassigned)
    res = verifier_client.get("/api/v1/verification/queue?assignment=unassigned")
    assert res.status_code == status.HTTP_200_OK
    assert len(res.json()) >= 1

    # 2. Assign application to verifier
    admin_client.post(
        "/api/v1/verification/assignments",
        {
            "application_id": str(submitted_application.id),
            "verifier_id": str(verifier_user.id),
        },
        content_type="application/json",
    )

    # 3. Queue list filter by assigned_to_me
    res_my = verifier_client.get("/api/v1/verification/queue?assignment=assigned_to_me")
    assert res_my.status_code == status.HTTP_200_OK
    assert len(res_my.json()) == 1
    assert res_my.json()[0]["registration_number"] == submitted_application.registration_number


@pytest.mark.django_db
def test_verification_complete_missing_required_document_blocked(
    verifier_client: Client,
    submitted_application: Application,
    document_requirement: DocumentRequirement,
):
    # Try to verify application without required KK document uploaded
    res = verifier_client.post(
        f"/api/v1/verification/applications/{submitted_application.id}/complete",
        {"to_status": VerificationReviewStatus.VERIFIED, "notes": "Disetujui"},
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Missing required documents" in str(res.json())


@pytest.mark.django_db
def test_verification_complete_pending_document_blocked(
    parent_user: User,
    verifier_client: Client,
    submitted_application: Application,
    document_requirement: DocumentRequirement,
):

    pdf = SimpleUploadedFile("kk.pdf", b"%PDF-1.4 Content", content_type="application/pdf")
    DocumentService.upload_document(
        parent_user, submitted_application.id, document_requirement.id, pdf
    )

    # Verifier tries to complete verification as VERIFIED while document is still PENDING
    res = verifier_client.post(
        f"/api/v1/verification/applications/{submitted_application.id}/complete",
        {"to_status": VerificationReviewStatus.VERIFIED, "notes": "Disetujui"},
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "pending, invalid, or require revision" in str(res.json())


@pytest.mark.django_db
def test_verification_complete_success(
    parent_user: User,
    verifier_user: User,
    verifier_client: Client,
    submitted_application: Application,
    document_requirement: DocumentRequirement,
):
    # Upload and verify required document as VALID
    pdf = SimpleUploadedFile("kk.pdf", b"%PDF-1.4 Content", content_type="application/pdf")
    doc = DocumentService.upload_document(
        parent_user, submitted_application.id, document_requirement.id, pdf
    )
    DocumentService.verify_document(
        verifier_user, doc.id, is_valid=True, verification_note="Dokumen sah"
    )

    # Complete application verification
    res = verifier_client.post(
        f"/api/v1/verification/applications/{submitted_application.id}/complete",
        {"to_status": VerificationReviewStatus.VERIFIED, "notes": "Berkas lengkap dan sah"},
        content_type="application/json",
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == VerificationReviewStatus.VERIFIED

    submitted_application.refresh_from_db()
    assert submitted_application.status == ApplicationStatus.VERIFIED


@pytest.mark.django_db
def test_unauthorized_access_blocked(parent_client: Client, submitted_application: Application):
    res = parent_client.get("/api/v1/verification/queue")
    assert res.status_code == status.HTTP_403_FORBIDDEN

    res_comp = parent_client.post(
        f"/api/v1/verification/applications/{submitted_application.id}/complete",
        {"to_status": VerificationReviewStatus.VERIFIED},
        content_type="application/json",
    )
    assert res_comp.status_code == status.HTTP_403_FORBIDDEN
