"""DRF serializers for admission domain models."""

from __future__ import annotations

from typing import Any, ClassVar

from rest_framework import serializers

from apps.admission.models import (
    AcademicYear,
    AdmissionPeriod,
    Applicant,
    Application,
    ApplicationDocument,
    ApplicationStatus,
    ApplicationStatusHistory,
    DocumentRequirement,
    DocumentRevision,
    Guardian,
    GuardianRelationship,
)


class AvailabilityStatus:
    OPEN = "OPEN"
    BEFORE_OPENING = "BEFORE_OPENING"
    CLOSED = "CLOSED"
    PERIOD_INACTIVE = "PERIOD_INACTIVE"
    ACADEMIC_YEAR_INACTIVE = "ACADEMIC_YEAR_INACTIVE"


AVAILABILITY_STATUS_CHOICES = [
    (AvailabilityStatus.OPEN, "Open"),
    (AvailabilityStatus.BEFORE_OPENING, "Before Opening"),
    (AvailabilityStatus.CLOSED, "Closed"),
    (AvailabilityStatus.PERIOD_INACTIVE, "Period Inactive"),
    (AvailabilityStatus.ACADEMIC_YEAR_INACTIVE, "Academic Year Inactive"),
]


class AcademicYearSerializer(serializers.ModelSerializer[AcademicYear]):
    class Meta:
        model = AcademicYear
        fields = [
            "id",
            "name",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AcademicYearCreateSerializer(serializers.ModelSerializer[AcademicYear]):
    class Meta:
        model = AcademicYear
        fields = ["name", "start_date", "end_date", "is_active"]
        extra_kwargs: ClassVar[dict[str, Any]] = {"is_active": {"validators": []}}

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and start >= end:
            raise serializers.ValidationError(
                {"start_date": "Start date must be strictly before end date."}
            )
        return attrs


class AcademicYearUpdateSerializer(serializers.ModelSerializer[AcademicYear]):
    name = serializers.CharField(required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = AcademicYear
        fields = ["name", "start_date", "end_date", "is_active"]
        extra_kwargs: ClassVar[dict[str, Any]] = {"is_active": {"validators": []}}

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and start >= end:
            raise serializers.ValidationError(
                {"start_date": "Start date must be strictly before end date."}
            )
        return attrs


class AdmissionPeriodSerializer(serializers.ModelSerializer[AdmissionPeriod]):
    academic_year_id = serializers.UUIDField(source="academic_year.id", read_only=True)

    class Meta:
        model = AdmissionPeriod
        fields = [
            "id",
            "academic_year_id",
            "name",
            "code",
            "registration_start",
            "registration_end",
            "announcement_at",
            "quota",
            "is_active",
            "settings",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AdmissionPeriodCreateSerializer(serializers.ModelSerializer[AdmissionPeriod]):
    academic_year_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = AdmissionPeriod
        fields = [
            "academic_year_id",
            "name",
            "code",
            "registration_start",
            "registration_end",
            "announcement_at",
            "quota",
            "is_active",
            "settings",
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        reg_start = attrs.get("registration_start")
        reg_end = attrs.get("registration_end")
        announcement = attrs.get("announcement_at")
        quota = attrs.get("quota")

        if reg_start and reg_end and reg_start >= reg_end:
            raise serializers.ValidationError(
                {"registration_start": "Registration start must be before registration end."}
            )

        if announcement and reg_end and announcement < reg_end:
            raise serializers.ValidationError(
                {"announcement_at": "Announcement date cannot be earlier than registration end."}
            )

        if quota is not None and quota < 0:
            raise serializers.ValidationError({"quota": "Quota must be non-negative."})

        return attrs


class AdmissionPeriodUpdateSerializer(serializers.ModelSerializer[AdmissionPeriod]):
    name = serializers.CharField(required=False)
    code = serializers.CharField(required=False)
    registration_start = serializers.DateTimeField(required=False)
    registration_end = serializers.DateTimeField(required=False)
    announcement_at = serializers.DateTimeField(required=False, allow_null=True)
    quota = serializers.IntegerField(required=False, allow_null=True)
    is_active = serializers.BooleanField(required=False)
    settings = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = AdmissionPeriod
        fields = [
            "name",
            "code",
            "registration_start",
            "registration_end",
            "announcement_at",
            "quota",
            "is_active",
            "settings",
        ]

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        reg_start = attrs.get(
            "registration_start", getattr(self.instance, "registration_start", None)
        )
        reg_end = attrs.get("registration_end", getattr(self.instance, "registration_end", None))
        announcement = (
            attrs["announcement_at"]
            if "announcement_at" in attrs
            else getattr(self.instance, "announcement_at", None)
        )
        quota = attrs["quota"] if "quota" in attrs else getattr(self.instance, "quota", None)

        if reg_start and reg_end and reg_start >= reg_end:
            raise serializers.ValidationError(
                {"registration_start": "Registration start must be before registration end."}
            )

        if announcement and reg_end and announcement < reg_end:
            raise serializers.ValidationError(
                {"announcement_at": "Announcement date cannot be earlier than registration end."}
            )

        if quota is not None and quota < 0:
            raise serializers.ValidationError({"quota": "Quota must be non-negative."})

        return attrs


class AdmissionPeriodAvailabilitySerializer(serializers.Serializer[dict[str, Any]]):
    period_id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=AVAILABILITY_STATUS_CHOICES)
    is_open = serializers.BooleanField()
    can_create_draft = serializers.BooleanField()
    can_submit = serializers.BooleanField()
    registration_start = serializers.DateTimeField()
    registration_end = serializers.DateTimeField()
    server_time = serializers.DateTimeField()
    quota = serializers.IntegerField(allow_null=True)
    reason = serializers.CharField(allow_null=True)


class ApplicantSerializer(serializers.ModelSerializer[Applicant]):
    owner_user_id = serializers.UUIDField(source="owner_user.id", read_only=True)

    class Meta:
        model = Applicant
        fields = [
            "id",
            "owner_user_id",
            "nisn",
            "full_name",
            "nickname",
            "gender",
            "birth_place",
            "birth_date",
            "religion",
            "nationality",
            "nik",
            "family_card_number",
            "address",
            "province",
            "city",
            "district",
            "village",
            "postal_code",
            "previous_school_name",
            "previous_school_npsn",
            "previous_school_address",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ApplicantCreateSerializer(serializers.ModelSerializer[Applicant]):
    class Meta:
        model = Applicant
        fields = [
            "nisn",
            "full_name",
            "nickname",
            "gender",
            "birth_place",
            "birth_date",
            "religion",
            "nationality",
            "nik",
            "family_card_number",
            "address",
            "province",
            "city",
            "district",
            "village",
            "postal_code",
            "previous_school_name",
            "previous_school_npsn",
            "previous_school_address",
        ]

    def validate_nik(self, value: str | None) -> str | None:
        if value and len(value) > 30:
            raise serializers.ValidationError("NIK maximum length is 30 characters.")
        return value

    def validate_nisn(self, value: str | None) -> str | None:
        if value and len(value) > 20:
            raise serializers.ValidationError("NISN maximum length is 20 characters.")
        return value


class ApplicantUpdateSerializer(serializers.ModelSerializer[Applicant]):
    full_name = serializers.CharField(required=False)
    gender = serializers.CharField(required=False)
    birth_place = serializers.CharField(required=False)
    birth_date = serializers.DateField(required=False)
    address = serializers.CharField(required=False)

    class Meta:
        model = Applicant
        fields = [
            "nisn",
            "full_name",
            "nickname",
            "gender",
            "birth_place",
            "birth_date",
            "religion",
            "nationality",
            "nik",
            "family_card_number",
            "address",
            "province",
            "city",
            "district",
            "village",
            "postal_code",
            "previous_school_name",
            "previous_school_npsn",
            "previous_school_address",
        ]


class GuardianSerializer(serializers.ModelSerializer[Guardian]):
    applicant_id = serializers.UUIDField(source="applicant.id", read_only=True)

    class Meta:
        model = Guardian
        fields = [
            "id",
            "applicant_id",
            "relationship",
            "full_name",
            "nik",
            "phone",
            "email",
            "occupation",
            "education",
            "monthly_income",
            "address",
            "is_primary_contact",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class GuardianCreateSerializer(serializers.ModelSerializer[Guardian]):
    class Meta:
        model = Guardian
        fields = [
            "relationship",
            "full_name",
            "nik",
            "phone",
            "email",
            "occupation",
            "education",
            "monthly_income",
            "address",
            "is_primary_contact",
        ]

    def validate_relationship(self, value: str) -> str:
        valid_choices = [c[0] for c in GuardianRelationship.choices]
        if value not in valid_choices:
            raise serializers.ValidationError(f"Invalid relationship. Choices are {valid_choices}.")
        return value


class GuardianUpdateSerializer(serializers.ModelSerializer[Guardian]):
    relationship = serializers.ChoiceField(choices=GuardianRelationship.choices, required=False)
    full_name = serializers.CharField(required=False)
    nik = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    phone = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    occupation = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    education = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    monthly_income = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False, allow_null=True
    )
    address = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_primary_contact = serializers.BooleanField(required=False)

    class Meta:
        model = Guardian
        fields = [
            "relationship",
            "full_name",
            "nik",
            "phone",
            "email",
            "occupation",
            "education",
            "monthly_income",
            "address",
            "is_primary_contact",
        ]


class ApplicationStatusHistorySerializer(serializers.ModelSerializer[ApplicationStatusHistory]):
    changed_by_id = serializers.UUIDField(source="changed_by.id", read_only=True, allow_null=True)
    changed_by_name = serializers.CharField(
        source="changed_by.name", read_only=True, allow_null=True
    )

    class Meta:
        model = ApplicationStatusHistory
        fields = [
            "id",
            "application_id",
            "from_status",
            "to_status",
            "changed_by_id",
            "changed_by_name",
            "reason",
            "metadata",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ApplicationSerializer(serializers.ModelSerializer[Application]):
    applicant_id = serializers.UUIDField(source="applicant.id", read_only=True)
    admission_period_id = serializers.UUIDField(source="admission_period.id", read_only=True)
    applicant_name = serializers.CharField(source="applicant.full_name", read_only=True)
    period_name = serializers.CharField(source="admission_period.name", read_only=True)
    status_histories = ApplicationStatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = [
            "id",
            "applicant_id",
            "applicant_name",
            "admission_period_id",
            "period_name",
            "registration_number",
            "status",
            "submitted_at",
            "verified_at",
            "assessed_at",
            "decided_at",
            "enrolled_at",
            "current_step",
            "completion_percentage",
            "status_histories",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ApplicationCreateDraftSerializer(serializers.Serializer[dict[str, Any]]):
    applicant_id = serializers.UUIDField()
    admission_period_id = serializers.UUIDField()


class ApplicationTransitionSerializer(serializers.Serializer[dict[str, Any]]):
    to_status = serializers.ChoiceField(choices=ApplicationStatus.choices)
    reason = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    metadata = serializers.JSONField(required=False, allow_null=True)


class DocumentRequirementSerializer(serializers.ModelSerializer[DocumentRequirement]):
    admission_period_id = serializers.UUIDField(
        source="admission_period.id", read_only=True, allow_null=True
    )

    class Meta:
        model = DocumentRequirement
        fields = [
            "id",
            "admission_period_id",
            "name",
            "code",
            "description",
            "is_required",
            "allowed_mime_types",
            "max_file_size_bytes",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DocumentRequirementCreateSerializer(serializers.ModelSerializer[DocumentRequirement]):
    admission_period_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = DocumentRequirement
        fields = [
            "admission_period_id",
            "name",
            "code",
            "description",
            "is_required",
            "allowed_mime_types",
            "max_file_size_bytes",
            "is_active",
            "sort_order",
        ]


class DocumentRequirementUpdateSerializer(serializers.ModelSerializer[DocumentRequirement]):
    name = serializers.CharField(required=False)
    code = serializers.CharField(required=False)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    is_required = serializers.BooleanField(required=False)
    allowed_mime_types = serializers.JSONField(required=False)
    max_file_size_bytes = serializers.IntegerField(required=False)
    is_active = serializers.BooleanField(required=False)
    sort_order = serializers.IntegerField(required=False)

    class Meta:
        model = DocumentRequirement
        fields = [
            "name",
            "code",
            "description",
            "is_required",
            "allowed_mime_types",
            "max_file_size_bytes",
            "is_active",
            "sort_order",
        ]


class DocumentRevisionSerializer(serializers.ModelSerializer[DocumentRevision]):
    requested_by_id = serializers.UUIDField(source="requested_by.id", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.name", read_only=True)

    class Meta:
        model = DocumentRevision
        fields = [
            "id",
            "application_document_id",
            "requested_by_id",
            "requested_by_name",
            "reason",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ApplicationDocumentSerializer(serializers.ModelSerializer[ApplicationDocument]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    requirement_id = serializers.UUIDField(source="requirement.id", read_only=True)
    requirement_name = serializers.CharField(source="requirement.name", read_only=True)
    requirement_code = serializers.CharField(source="requirement.code", read_only=True)
    verified_by_id = serializers.UUIDField(source="verified_by.id", read_only=True, allow_null=True)
    verified_by_name = serializers.CharField(
        source="verified_by.name", read_only=True, allow_null=True
    )
    revisions = DocumentRevisionSerializer(many=True, read_only=True)

    class Meta:
        model = ApplicationDocument
        fields = [
            "id",
            "application_id",
            "requirement_id",
            "requirement_name",
            "requirement_code",
            "storage_key",
            "original_filename",
            "mime_type",
            "file_size",
            "checksum",
            "status",
            "uploaded_at",
            "verified_at",
            "verified_by_id",
            "verified_by_name",
            "verification_note",
            "version",
            "revisions",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DocumentVerifySerializer(serializers.Serializer[dict[str, Any]]):
    is_valid_doc = serializers.BooleanField()
    verification_note = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class DocumentRevisionRequestSerializer(serializers.Serializer[dict[str, Any]]):
    reason = serializers.CharField(required=True)
