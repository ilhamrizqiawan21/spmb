"""Academic year and admission period models for SPMB Terpadu."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.common.models import BaseModel


class AcademicYear(BaseModel):
    """An academic year (e.g. 2026/2027) bounding admission periods."""

    name = models.CharField(max_length=50, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        db_table = "academic_years"
        ordering = ["-start_date"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(start_date__lt=models.F("end_date")),
                name="ck_academic_years_start_before_end",
            ),
            models.UniqueConstraint(
                fields=["is_active"],
                condition=models.Q(is_active=True),
                name="uq_academic_years_single_active",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class AdmissionPeriod(BaseModel):
    """An admission wave or track (e.g. Gelombang 1, Jalur Reguler) under an academic year."""

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.RESTRICT,
        related_name="admission_periods",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=100)
    registration_start = models.DateTimeField()
    registration_end = models.DateTimeField()
    announcement_at = models.DateTimeField(null=True, blank=True)
    quota = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    settings = models.JSONField(null=True, blank=True, default=dict)

    class Meta:
        db_table = "admission_periods"
        ordering = ["registration_start"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(registration_start__lt=models.F("registration_end")),
                name="ck_admission_periods_start_before_end",
            ),
            models.CheckConstraint(
                condition=models.Q(quota__isnull=True) | models.Q(quota__gte=0),
                name="ck_admission_periods_quota_non_negative",
            ),
            models.UniqueConstraint(
                fields=["academic_year", "code"],
                name="uq_admission_periods_academic_year_code",
            ),
        ]
        indexes = [
            models.Index(fields=["academic_year"], name="ix_admission_periods_ay_id"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Applicant(BaseModel):
    """Applicant model storing identity and background information of prospective students."""

    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applicants",
    )
    nisn = models.CharField(max_length=20, null=True, blank=True)
    full_name = models.CharField(max_length=200)
    nickname = models.CharField(max_length=100, null=True, blank=True)
    gender = models.CharField(max_length=20)
    birth_place = models.CharField(max_length=150)
    birth_date = models.DateField()
    religion = models.CharField(max_length=50, null=True, blank=True)
    nationality = models.CharField(max_length=50, default="Indonesia")
    nik = models.CharField(max_length=30, null=True, blank=True)
    family_card_number = models.CharField(max_length=30, null=True, blank=True)

    address = models.TextField()
    province = models.CharField(max_length=100, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    district = models.CharField(max_length=100, null=True, blank=True)
    village = models.CharField(max_length=100, null=True, blank=True)
    postal_code = models.CharField(max_length=10, null=True, blank=True)

    previous_school_name = models.CharField(max_length=200, null=True, blank=True)
    previous_school_npsn = models.CharField(max_length=30, null=True, blank=True)
    previous_school_address = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "applicants"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner_user"], name="ix_applicants_owner_user_id"),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.id})"


class GuardianRelationship(models.TextChoices):
    FATHER = "FATHER", "Father"
    MOTHER = "MOTHER", "Mother"
    GUARDIAN = "GUARDIAN", "Guardian"


class Guardian(BaseModel):
    """Guardian model storing father, mother, or legal guardian details for an applicant."""

    applicant = models.ForeignKey(
        Applicant,
        on_delete=models.CASCADE,
        related_name="guardians",
    )
    relationship = models.CharField(
        max_length=30,
        choices=GuardianRelationship.choices,
    )
    full_name = models.CharField(max_length=200)
    nik = models.CharField(max_length=30, null=True, blank=True)
    phone = models.CharField(max_length=30, null=True, blank=True)
    email = models.EmailField(max_length=255, null=True, blank=True)
    occupation = models.CharField(max_length=150, null=True, blank=True)
    education = models.CharField(max_length=100, null=True, blank=True)
    monthly_income = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    is_primary_contact = models.BooleanField(default=False)

    class Meta:
        db_table = "guardians"
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(relationship__in=["FATHER", "MOTHER", "GUARDIAN"]),
                name="ck_guardians_relationship_valid",
            ),
            models.UniqueConstraint(
                fields=["applicant", "relationship"],
                name="uq_guardians_applicant_relationship",
            ),
        ]
        indexes = [
            models.Index(fields=["applicant"], name="ix_guardians_applicant_id"),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.relationship})"


class ApplicationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"
    UNDER_VERIFICATION = "UNDER_VERIFICATION", "Under Verification"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Revision Required"
    RESUBMITTED = "RESUBMITTED", "Resubmitted"
    VERIFIED = "VERIFIED", "Verified"
    ASSESSMENT_SCHEDULED = "ASSESSMENT_SCHEDULED", "Assessment Scheduled"
    ASSESSED = "ASSESSED", "Assessed"
    ACCEPTED = "ACCEPTED", "Accepted"
    WAITLISTED = "WAITLISTED", "Waitlisted"
    REJECTED = "REJECTED", "Rejected"
    RE_REGISTRATION = "RE_REGISTRATION", "Re-registration"
    RE_REGISTRATION_VERIFIED = "RE_REGISTRATION_VERIFIED", "Re-registration Verified"
    ENROLLED = "ENROLLED", "Enrolled"
    MPLS_ACTIVE = "MPLS_ACTIVE", "MPLS Active"
    MPLS_COMPLETED = "MPLS_COMPLETED", "MPLS Completed"
    COMPLETED = "COMPLETED", "Completed"


class Application(BaseModel):
    """Core admission application record linking applicant and period."""

    applicant = models.ForeignKey(
        Applicant,
        on_delete=models.CASCADE,
        related_name="applications",
    )
    admission_period = models.ForeignKey(
        AdmissionPeriod,
        on_delete=models.RESTRICT,
        related_name="applications",
    )
    registration_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    status = models.CharField(
        max_length=50,
        choices=ApplicationStatus.choices,
        default=ApplicationStatus.DRAFT,
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    assessed_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    enrolled_at = models.DateTimeField(null=True, blank=True)
    current_step = models.IntegerField(default=1)
    completion_percentage = models.IntegerField(default=0)

    class Meta:
        db_table = "applications"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["applicant", "admission_period"],
                name="uq_applications_applicant_period",
            ),
        ]
        indexes = [
            models.Index(fields=["applicant"], name="ix_applications_applicant_id"),
            models.Index(fields=["admission_period"], name="ix_applications_period_id"),
            models.Index(fields=["status"], name="ix_applications_status"),
        ]

    def __str__(self) -> str:
        reg = self.registration_number or "NO-REG"
        return f"Application {reg} ({self.status})"


class ApplicationStatusHistory(BaseModel):
    """Audit trail recording application state transitions."""

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="status_histories",
    )
    from_status = models.CharField(max_length=50, null=True, blank=True)
    to_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="application_status_changes",
    )
    reason = models.TextField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True, default=dict)

    class Meta:
        db_table = "application_status_histories"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["application"], name="ix_app_status_hist_app_id"),
        ]

    def __str__(self) -> str:
        return f"History {self.application_id}: {self.from_status} -> {self.to_status}"


class DocumentRequirement(BaseModel):
    """Defines mandatory or optional document requirements for admission periods."""

    admission_period = models.ForeignKey(
        AdmissionPeriod,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="document_requirements",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    is_required = models.BooleanField(default=True)
    allowed_mime_types = models.JSONField(
        default=list,
        help_text="Allowed MIME types, e.g. ['application/pdf', 'image/jpeg', 'image/png']",
    )
    max_file_size_bytes = models.BigIntegerField(default=5242880)

    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "document_requirements"
        ordering = ["sort_order", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["admission_period", "code"],
                name="uq_doc_requirements_period_code",
            ),
        ]
        indexes = [
            models.Index(fields=["admission_period"], name="ix_doc_req_period_id"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class ApplicationDocumentStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Verification"
    VALID = "VALID", "Valid"
    INVALID = "INVALID", "Invalid"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Revision Required"


class ApplicationDocument(BaseModel):
    """Stores uploaded document metadata for an application."""

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    requirement = models.ForeignKey(
        DocumentRequirement,
        on_delete=models.RESTRICT,
        related_name="application_documents",
    )
    storage_key = models.TextField()
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100)
    file_size = models.BigIntegerField()
    checksum = models.CharField(max_length=128, null=True, blank=True)

    status = models.CharField(
        max_length=30,
        choices=ApplicationDocumentStatus.choices,
        default=ApplicationDocumentStatus.PENDING,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_documents",
    )
    verification_note = models.TextField(null=True, blank=True)
    version = models.IntegerField(default=1)

    class Meta:
        db_table = "application_documents"
        ordering = ["requirement", "-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["application", "requirement", "version"],
                name="uq_app_docs_app_req_version",
            ),
        ]
        indexes = [
            models.Index(fields=["application"], name="ix_app_docs_app_id"),
            models.Index(fields=["requirement"], name="ix_app_docs_req_id"),
            models.Index(fields=["status"], name="ix_app_docs_status"),
        ]

    def __str__(self) -> str:
        return f"Document {self.original_filename} (v{self.version})"


class DocumentRevision(BaseModel):
    """Tracks document revision requests and resolution."""

    application_document = models.ForeignKey(
        ApplicationDocument,
        on_delete=models.CASCADE,
        related_name="revisions",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="requested_document_revisions",
    )
    reason = models.TextField()
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "document_revisions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application_document"], name="ix_doc_rev_doc_id"),
        ]

    def __str__(self) -> str:
        return f"Revision for Doc {self.application_document_id}"
