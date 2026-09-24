"""Tests for Document Requirement and Application Document Management (F7)."""

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
    ApplicationDocument,
    ApplicationDocumentStatus,
    ApplicationStatus,
    DocumentRequirement,
    GuardianRelationship,
)
from apps.auth.models import Role, User, UserRole
from apps.common.storage import get_storage


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
        email="parent.doc@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def other_parent_user(db: None) -> User:
    user = User.objects.create_user(
        name="Other Parent",
        email="other.doc@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin User",
        email="admin.doc@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="super_admin")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def verifier_user(db: None) -> User:
    user = User.objects.create_user(
        name="Verifier User",
        email="verifier.doc@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="verifier")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_client(parent_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parent.doc@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def other_parent_client(other_parent_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "other.doc@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin.doc@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def verifier_client(verifier_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "verifier.doc@example.test", "password": "ValidPassword123!"},
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
        allowed_mime_types=["application/pdf", "image/jpeg", "image/png"],
        max_file_size_bytes=2 * 1024 * 1024,
    )


@pytest.fixture
def application(parent_user: User, active_period: AdmissionPeriod) -> Application:
    applicant = Applicant.objects.create(
        owner_user=parent_user,
        full_name="Ananda Santri",
        gender="MALE",
        birth_date=date(2015, 5, 10),
        birth_place="Bandung",
        religion="ISLAM",
        address="Jl. Al-Ihsan No. 1",
    )
    applicant.guardians.create(
        relationship=GuardianRelationship.FATHER,
        full_name="Bapak Santri",
        phone="081234567890",
        address="Jl. Al-Ihsan No. 1",
        is_primary_contact=True,
    )
    return Application.objects.create(
        applicant=applicant,
        admission_period=active_period,
        registration_number="REG-2027-DOC01",
        status=ApplicationStatus.DRAFT,
        current_step=1,
        completion_percentage=80,
    )


@pytest.mark.django_db
def test_document_requirement_admin_crud(admin_client: Client, active_period: AdmissionPeriod):
    # 1. Create requirement
    response = admin_client.post(
        "/api/v1/admission/document-requirements",
        {
            "admission_period_id": str(active_period.id),
            "name": "Ijazah",
            "code": "IJAZAH",
            "is_required": True,
            "allowed_mime_types": ["application/pdf"],
            "max_file_size_bytes": 5 * 1024 * 1024,
        },
        content_type="application/json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    req_id = response.json()["id"]

    # 2. List requirements
    response = admin_client.get("/api/v1/admission/document-requirements")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) >= 1

    # 3. Update requirement
    response = admin_client.patch(
        f"/api/v1/admission/document-requirements/{req_id}",
        {"is_required": False},
        content_type="application/json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["is_required"] is False


@pytest.mark.django_db
def test_document_upload_success(
    parent_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    pdf_content = b"%PDF-1.4 Mock PDF file content for testing"
    dummy_file = SimpleUploadedFile("kk.pdf", pdf_content, content_type="application/pdf")

    response = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": dummy_file,
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["original_filename"] == "kk.pdf"
    assert data["mime_type"] == "application/pdf"
    assert data["status"] == ApplicationDocumentStatus.PENDING
    assert data["version"] == 1


@pytest.mark.django_db
def test_document_upload_invalid_mime_type(
    parent_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    exec_file = SimpleUploadedFile(
        "script.sh", b"#!/bin/bash echo hello", content_type="text/x-shellscript"
    )

    response = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": exec_file,
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "MIME type" in str(response.json())


@pytest.mark.django_db
def test_document_upload_oversized_file(
    parent_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    # Set limit to 10 bytes for test
    document_requirement.max_file_size_bytes = 10
    document_requirement.save()

    large_file = SimpleUploadedFile(
        "kk.pdf", b"This file content exceeds 10 bytes limit", content_type="application/pdf"
    )

    response = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": large_file,
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "File size exceeds" in str(response.json())


@pytest.mark.django_db
def test_submit_application_missing_required_document(
    parent_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    response = parent_client.post(f"/api/v1/admission/applications/{application.id}/submit")
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "missing required documents" in str(response.json())


@pytest.mark.django_db
def test_document_download_authorized_and_unauthorized(
    parent_client: Client,
    other_parent_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    pdf_content = b"%PDF-1.4 Private Document Content"
    dummy_file = SimpleUploadedFile("kk.pdf", pdf_content, content_type="application/pdf")

    res = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": dummy_file,
        },
    )
    doc_id = res.json()["id"]

    # Authorized download by owner
    download_res = parent_client.get(f"/api/v1/admission/documents/{doc_id}/download")
    assert download_res.status_code == status.HTTP_200_OK
    assert download_res.getvalue() == pdf_content

    # Unauthorized download attempt by another parent
    unauth_res = other_parent_client.get(f"/api/v1/admission/documents/{doc_id}/download")
    assert unauth_res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_document_download_signed_url(
    parent_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    pdf_content = b"%PDF-1.4 Signed URL Document"
    dummy_file = SimpleUploadedFile("kk.pdf", pdf_content, content_type="application/pdf")

    res = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": dummy_file,
        },
    )
    doc_id = res.json()["id"]
    doc = ApplicationDocument.objects.get(pk=doc_id)

    storage = get_storage()
    signed_url = storage.generate_signed_url(doc.storage_key)
    token = signed_url.split("token=")[1]

    anonymous_client = Client()
    download_res = anonymous_client.get(
        f"/api/v1/admission/documents/{doc_id}/download?token={token}"
    )
    assert download_res.status_code == status.HTTP_200_OK
    assert download_res.getvalue() == pdf_content


@pytest.mark.django_db
def test_document_verification_and_revision_flow(
    parent_client: Client,
    verifier_client: Client,
    application: Application,
    document_requirement: DocumentRequirement,
):
    pdf_content = b"%PDF-1.4 Original Document v1"
    dummy_file = SimpleUploadedFile("kk.pdf", pdf_content, content_type="application/pdf")

    res = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": dummy_file,
        },
    )
    doc_id = res.json()["id"]

    # Parent submits application
    submit_res = parent_client.post(f"/api/v1/admission/applications/{application.id}/submit")
    assert submit_res.status_code == status.HTTP_200_OK
    assert submit_res.json()["status"] == ApplicationStatus.SUBMITTED

    # Transition to UNDER_VERIFICATION
    verifier_client.post(
        f"/api/v1/admission/applications/{application.id}/transition",
        {"to_status": ApplicationStatus.UNDER_VERIFICATION},
        content_type="application/json",
    )

    # Verifier requests revision for document
    rev_res = verifier_client.post(
        f"/api/v1/admission/documents/{doc_id}/request-revision",
        {"reason": "Foto KK buram dan tidak terbaca"},
        content_type="application/json",
    )
    assert rev_res.status_code == status.HTTP_200_OK
    assert rev_res.json()["status"] == ApplicationDocumentStatus.REVISION_REQUIRED

    # Application status should change to REVISION_REQUIRED
    application.refresh_from_db()
    assert application.status == ApplicationStatus.REVISION_REQUIRED

    # Parent uploads revised document (v2)
    pdf_content_v2 = b"%PDF-1.4 Revised Document v2"
    dummy_file_v2 = SimpleUploadedFile(
        "kk_clear.pdf", pdf_content_v2, content_type="application/pdf"
    )
    upload_v2_res = parent_client.post(
        f"/api/v1/admission/applications/{application.id}/documents",
        {
            "requirement_id": str(document_requirement.id),
            "file": dummy_file_v2,
        },
    )
    assert upload_v2_res.status_code == status.HTTP_201_CREATED
    v2_doc_id = upload_v2_res.json()["id"]
    assert upload_v2_res.json()["version"] == 2

    # Verifier verifies v2 document as VALID
    verify_res = verifier_client.post(
        f"/api/v1/admission/documents/{v2_doc_id}/verify",
        {"is_valid_doc": True, "verification_note": "Dokumen jelas dan valid"},
        content_type="application/json",
    )
    assert verify_res.status_code == status.HTTP_200_OK
    assert verify_res.json()["status"] == ApplicationDocumentStatus.VALID
