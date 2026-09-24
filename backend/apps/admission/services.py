"""Domain services for admission lifecycle and workflow."""

from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any

from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.admission.models import (
    AcademicYear,
    AdmissionPeriod,
    Applicant,
    Application,
    ApplicationDocument,
    ApplicationDocumentStatus,
    ApplicationStatus,
    ApplicationStatusHistory,
    DocumentRequirement,
    DocumentRevision,
    Guardian,
)
from apps.admission.serializers import AvailabilityStatus
from apps.common.storage import get_storage


class AcademicYearService:
    """Service governing Academic Year lifecycles and active status constraints."""

    @staticmethod
    @transaction.atomic
    def create(validated_data: dict[str, Any]) -> AcademicYear:
        name = validated_data.get("name")
        if AcademicYear.objects.filter(name__iexact=name).exists():
            raise ValidationError({"name": "Academic year with this name already exists."})

        is_active = validated_data.get("is_active", False)
        if is_active:
            AcademicYear.objects.filter(is_active=True).update(is_active=False)

        return AcademicYear.objects.create(**validated_data)

    @staticmethod
    @transaction.atomic
    def update(instance: AcademicYear, validated_data: dict[str, Any]) -> AcademicYear:
        new_name = validated_data.get("name")
        if new_name and new_name != instance.name:
            if AcademicYear.objects.filter(name__iexact=new_name).exclude(pk=instance.pk).exists():
                raise ValidationError({"name": "Academic year with this name already exists."})

        is_active = validated_data.get("is_active")
        if is_active is True:
            AcademicYear.objects.filter(is_active=True).exclude(pk=instance.pk).update(
                is_active=False
            )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    @staticmethod
    def delete(instance: AcademicYear) -> None:
        if instance.admission_periods.exists():
            raise ValidationError(
                {"detail": "Cannot delete academic year with existing admission periods."}
            )
        instance.delete()

    @staticmethod
    def get_active() -> AcademicYear | None:
        return AcademicYear.objects.filter(is_active=True).first()


class AdmissionPeriodService:
    """Service governing Admission Period management."""

    @staticmethod
    def create(validated_data: dict[str, Any]) -> AdmissionPeriod:
        ay_id = validated_data.pop("academic_year_id")
        try:
            academic_year = AcademicYear.objects.get(pk=ay_id)
        except AcademicYear.DoesNotExist as exc:
            raise NotFound(
                {"academic_year_id": "Referenced academic year does not exist."}
            ) from exc

        code = validated_data.get("code")
        if AdmissionPeriod.objects.filter(academic_year=academic_year, code__iexact=code).exists():
            raise ValidationError(
                {"code": "Admission period code already exists in this academic year."}
            )

        return AdmissionPeriod.objects.create(academic_year=academic_year, **validated_data)

    @staticmethod
    def update(instance: AdmissionPeriod, validated_data: dict[str, Any]) -> AdmissionPeriod:
        new_code = validated_data.get("code")
        if new_code and new_code != instance.code:
            if (
                AdmissionPeriod.objects.filter(
                    academic_year=instance.academic_year, code__iexact=new_code
                )
                .exclude(pk=instance.pk)
                .exists()
            ):
                raise ValidationError(
                    {"code": "Admission period code already exists in this academic year."}
                )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    @staticmethod
    def delete(instance: AdmissionPeriod) -> None:
        instance.delete()


class RegistrationAvailabilityService:
    """Evaluates whether registration is open and enforces draft/submission eligibility."""

    @classmethod
    def evaluate_availability(
        cls,
        period: AdmissionPeriod,
        academic_year: AcademicYear | None = None,
        now: datetime | None = None,
    ) -> tuple[str, bool, str | None]:
        current_time = now or timezone.now()
        ay = academic_year or period.academic_year

        if ay and not ay.is_active:
            return (
                AvailabilityStatus.ACADEMIC_YEAR_INACTIVE,
                False,
                "The associated academic year is inactive.",
            )

        if not period.is_active:
            return (
                AvailabilityStatus.PERIOD_INACTIVE,
                False,
                "The admission period is currently inactive.",
            )

        if current_time < period.registration_start:
            formatted_start = period.registration_start.isoformat()
            return (
                AvailabilityStatus.BEFORE_OPENING,
                False,
                f"Registration has not opened yet. It will open at {formatted_start}.",
            )

        if current_time > period.registration_end:
            return (
                AvailabilityStatus.CLOSED,
                False,
                f"Registration closed at {period.registration_end.isoformat()}.",
            )

        return (AvailabilityStatus.OPEN, True, None)

    @classmethod
    def get_period_availability(
        cls, period_id: uuid.UUID, now: datetime | None = None
    ) -> dict[str, Any]:
        try:
            period = AdmissionPeriod.objects.select_related("academic_year").get(pk=period_id)
        except AdmissionPeriod.DoesNotExist as exc:
            raise NotFound({"detail": "Admission period not found."}) from exc

        current_time = now or timezone.now()
        status_code, is_open, reason = cls.evaluate_availability(
            period=period, academic_year=period.academic_year, now=current_time
        )

        return {
            "period_id": period.id,
            "status": status_code,
            "is_open": is_open,
            "can_create_draft": is_open,
            "can_submit": is_open,
            "registration_start": period.registration_start,
            "registration_end": period.registration_end,
            "server_time": current_time,
            "quota": period.quota,
            "reason": reason,
        }

    @classmethod
    def assert_can_create_draft(
        cls,
        period: AdmissionPeriod,
        academic_year: AcademicYear | None = None,
        now: datetime | None = None,
    ) -> None:
        status_code, is_open, reason = cls.evaluate_availability(
            period=period, academic_year=academic_year, now=now
        )
        if not is_open:
            raise PermissionDenied(
                {"detail": f"Cannot start draft: {reason or 'Registration unavailable.'}"}
            )

    @classmethod
    def assert_can_submit(
        cls,
        period: AdmissionPeriod,
        academic_year: AcademicYear | None = None,
        now: datetime | None = None,
    ) -> None:
        status_code, is_open, reason = cls.evaluate_availability(
            period=period, academic_year=academic_year, now=now
        )
        if not is_open:
            raise PermissionDenied(
                {"detail": f"Cannot submit application: {reason or 'Registration unavailable.'}"}
            )


class ApplicantService:
    """Service governing Applicant identity records and ownership verification."""

    @staticmethod
    def check_access(user: Any, applicant: Applicant) -> None:
        if applicant.owner_user_id == user.id:
            return
        has_perm = getattr(user, "has_any_perm_codes", None)
        if callable(has_perm) and user.has_any_perm_codes(
            ["application.read", "application.override"]
        ):
            return
        raise PermissionDenied({"detail": "You do not have permission to access this applicant."})

    @staticmethod
    def check_modify(user: Any, applicant: Applicant) -> None:
        if applicant.owner_user_id == user.id:
            return
        has_perm = getattr(user, "has_perm_code", None)
        if callable(has_perm) and user.has_perm_code("application.override"):
            return
        raise PermissionDenied({"detail": "You do not have permission to modify this applicant."})

    @classmethod
    def list_for_user(cls, user: Any) -> models.QuerySet[Applicant]:
        has_perm = getattr(user, "has_any_perm_codes", None)
        if callable(has_perm) and user.has_any_perm_codes(
            ["application.read", "application.override"]
        ):
            return Applicant.objects.all()
        return Applicant.objects.filter(owner_user=user)

    @classmethod
    def get_for_user(cls, user: Any, applicant_id: uuid.UUID) -> Applicant:
        try:
            applicant = Applicant.objects.get(pk=applicant_id)
        except Applicant.DoesNotExist as exc:
            raise NotFound({"detail": "Applicant not found."}) from exc

        cls.check_access(user, applicant)
        return applicant

    @classmethod
    def create(cls, user: Any, validated_data: dict[str, Any]) -> Applicant:
        return Applicant.objects.create(owner_user=user, **validated_data)

    @classmethod
    def update(cls, user: Any, instance: Applicant, validated_data: dict[str, Any]) -> Applicant:
        cls.check_modify(user, instance)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    @classmethod
    def delete(cls, user: Any, instance: Applicant) -> None:
        cls.check_modify(user, instance)
        instance.delete()


class GuardianService:
    """Service governing Guardian management and primary contact rules."""

    @classmethod
    def list_for_applicant(cls, user: Any, applicant_id: uuid.UUID) -> models.QuerySet[Guardian]:
        applicant = ApplicantService.get_for_user(user, applicant_id)
        return Guardian.objects.filter(applicant=applicant)

    @classmethod
    def get_for_applicant(
        cls, user: Any, applicant_id: uuid.UUID, guardian_id: uuid.UUID
    ) -> Guardian:
        applicant = ApplicantService.get_for_user(user, applicant_id)
        try:
            return Guardian.objects.get(pk=guardian_id, applicant=applicant)
        except Guardian.DoesNotExist as exc:
            raise NotFound({"detail": "Guardian not found."}) from exc

    @classmethod
    @transaction.atomic
    def create(cls, user: Any, applicant_id: uuid.UUID, validated_data: dict[str, Any]) -> Guardian:
        applicant = ApplicantService.get_for_user(user, applicant_id)
        ApplicantService.check_modify(user, applicant)

        relationship = validated_data.get("relationship")
        if Guardian.objects.filter(applicant=applicant, relationship=relationship).exists():
            raise ValidationError({"relationship": f"Guardian '{relationship}' already exists."})

        is_primary = validated_data.get("is_primary_contact", False)
        if is_primary:
            Guardian.objects.filter(applicant=applicant, is_primary_contact=True).update(
                is_primary_contact=False
            )

        return Guardian.objects.create(applicant=applicant, **validated_data)

    @classmethod
    @transaction.atomic
    def update(cls, user: Any, instance: Guardian, validated_data: dict[str, Any]) -> Guardian:
        applicant = ApplicantService.get_for_user(user, instance.applicant_id)
        ApplicantService.check_modify(user, applicant)

        new_relationship = validated_data.get("relationship")
        if new_relationship and new_relationship != instance.relationship:
            if (
                Guardian.objects.filter(applicant=applicant, relationship=new_relationship)
                .exclude(pk=instance.pk)
                .exists()
            ):
                raise ValidationError(
                    {"relationship": f"Guardian '{new_relationship}' already exists."}
                )

        is_primary = validated_data.get("is_primary_contact")
        if is_primary is True:
            Guardian.objects.filter(applicant=applicant, is_primary_contact=True).exclude(
                pk=instance.pk
            ).update(is_primary_contact=False)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance

    @classmethod
    def delete(cls, user: Any, instance: Guardian) -> None:
        applicant = ApplicantService.get_for_user(user, instance.applicant_id)
        ApplicantService.check_modify(user, applicant)
        instance.delete()


class RegistrationNumberGenerator:
    """Collision-safe generator for application registration numbers (REG-YYYY-XXXXXX)."""

    @classmethod
    @transaction.atomic
    def generate(cls, admission_period: AdmissionPeriod) -> str:
        year_str = str(admission_period.academic_year.start_date.year)
        prefix = f"REG-{year_str}-"
        last_reg = (
            Application.objects.filter(registration_number__startswith=prefix)
            .select_for_update()
            .order_by("-registration_number")
            .first()
        )
        if last_reg and last_reg.registration_number:
            try:
                seq = int(last_reg.registration_number.split("-")[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        return f"{prefix}{seq:06d}"


class ApplicationCompletionCalculator:
    """Calculates wizard completion percentage and step."""

    @classmethod
    def calculate(cls, application: Application) -> tuple[int, int]:
        applicant = application.applicant
        guardians_count = applicant.guardians.count()

        points = 0
        total = 5

        # 1. Basic info
        if applicant.full_name and applicant.gender and applicant.birth_date:
            points += 1
        # 2. Birth details & Religion
        if applicant.birth_place and applicant.religion:
            points += 1
        # 3. Address
        if applicant.address:
            points += 1
        # 4. Identity numbers (NIK/KK/NISN)
        if applicant.nik or applicant.nisn or applicant.family_card_number:
            points += 1
        # 5. Guardians
        if guardians_count >= 1:
            points += 1

        percentage = int((points / total) * 100)
        current_step = min(points + 1, total)
        return percentage, current_step


class ApplicationStateMachineService:
    """Central state machine governing legal transitions, permissions, and audit histories."""

    LEGAL_TRANSITIONS: dict[str, list[str]] = {
        ApplicationStatus.DRAFT: [ApplicationStatus.SUBMITTED],
        ApplicationStatus.SUBMITTED: [ApplicationStatus.UNDER_VERIFICATION],
        ApplicationStatus.UNDER_VERIFICATION: [
            ApplicationStatus.REVISION_REQUIRED,
            ApplicationStatus.VERIFIED,
        ],
        ApplicationStatus.REVISION_REQUIRED: [ApplicationStatus.RESUBMITTED],
        ApplicationStatus.RESUBMITTED: [
            ApplicationStatus.UNDER_VERIFICATION,
            ApplicationStatus.VERIFIED,
            ApplicationStatus.REVISION_REQUIRED,
        ],
        ApplicationStatus.VERIFIED: [
            ApplicationStatus.ASSESSMENT_SCHEDULED,
            ApplicationStatus.ASSESSED,
        ],
        ApplicationStatus.ASSESSMENT_SCHEDULED: [ApplicationStatus.ASSESSED],
        ApplicationStatus.ASSESSED: [
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.WAITLISTED,
            ApplicationStatus.REJECTED,
        ],
        ApplicationStatus.WAITLISTED: [
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.REJECTED,
        ],
        ApplicationStatus.ACCEPTED: [ApplicationStatus.RE_REGISTRATION],
        ApplicationStatus.RE_REGISTRATION: [ApplicationStatus.RE_REGISTRATION_VERIFIED],
        ApplicationStatus.RE_REGISTRATION_VERIFIED: [ApplicationStatus.ENROLLED],
        ApplicationStatus.ENROLLED: [ApplicationStatus.MPLS_ACTIVE],
        ApplicationStatus.MPLS_ACTIVE: [ApplicationStatus.MPLS_COMPLETED],
        ApplicationStatus.MPLS_COMPLETED: [ApplicationStatus.COMPLETED],
    }

    @classmethod
    def is_legal_transition(cls, from_status: str, to_status: str) -> bool:
        allowed = cls.LEGAL_TRANSITIONS.get(from_status, [])
        return to_status in allowed

    @classmethod
    @transaction.atomic
    def transition(
        cls,
        user: Any,
        application: Application,
        to_status: str,
        reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Application:
        from_status = application.status

        has_override = getattr(user, "has_perm_code", None) and user.has_perm_code(
            "application.override"
        )

        if not has_override:
            if not cls.is_legal_transition(from_status, to_status):
                raise ValidationError(
                    {"to_status": f"Transition from '{from_status}' to '{to_status}' is illegal."}
                )

        now = timezone.now()
        application.status = to_status

        if to_status == ApplicationStatus.SUBMITTED:
            application.submitted_at = now
        elif to_status == ApplicationStatus.VERIFIED:
            application.verified_at = now
        elif to_status == ApplicationStatus.ASSESSED:
            application.assessed_at = now
        elif to_status in [
            ApplicationStatus.ACCEPTED,
            ApplicationStatus.WAITLISTED,
            ApplicationStatus.REJECTED,
        ]:
            application.decided_at = now
        elif to_status == ApplicationStatus.ENROLLED:
            application.enrolled_at = now

        application.save()

        ApplicationStatusHistory.objects.create(
            application=application,
            from_status=from_status,
            to_status=to_status,
            changed_by=user if getattr(user, "is_authenticated", False) else None,
            reason=reason,
            metadata=metadata or {},
        )

        if hasattr(application, "_prefetched_objects_cache"):
            application._prefetched_objects_cache = {}

        return application


class ApplicationService:
    """Service governing Application creation, completion tracking, and submissions."""

    @classmethod
    def list_for_user(cls, user: Any) -> models.QuerySet[Application]:
        has_perm = getattr(user, "has_any_perm_codes", None)
        if callable(has_perm) and user.has_any_perm_codes(
            ["application.read", "application.override"]
        ):
            return Application.objects.select_related("applicant", "admission_period").all()
        return Application.objects.select_related("applicant", "admission_period").filter(
            applicant__owner_user=user
        )

    @classmethod
    def get_for_user(cls, user: Any, application_id: uuid.UUID) -> Application:
        try:
            application = (
                Application.objects.select_related("applicant", "admission_period")
                .prefetch_related("status_histories__changed_by")
                .get(pk=application_id)
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"detail": "Application not found."}) from exc

        ApplicantService.check_access(user, application.applicant)
        return application

    @classmethod
    @transaction.atomic
    def create_draft(
        cls, user: Any, applicant_id: uuid.UUID, admission_period_id: uuid.UUID
    ) -> Application:
        applicant = ApplicantService.get_for_user(user, applicant_id)
        ApplicantService.check_modify(user, applicant)

        try:
            period = AdmissionPeriod.objects.select_related("academic_year").get(
                pk=admission_period_id
            )
        except AdmissionPeriod.DoesNotExist as exc:
            raise NotFound({"admission_period_id": "Admission period not found."}) from exc

        RegistrationAvailabilityService.assert_can_create_draft(period)

        if Application.objects.filter(applicant=applicant, admission_period=period).exists():
            raise ValidationError(
                {"detail": "Application for this applicant and admission period already exists."}
            )

        reg_num = RegistrationNumberGenerator.generate(period)

        application = Application.objects.create(
            applicant=applicant,
            admission_period=period,
            registration_number=reg_num,
            status=ApplicationStatus.DRAFT,
            current_step=1,
            completion_percentage=0,
        )

        perc, step = ApplicationCompletionCalculator.calculate(application)
        application.completion_percentage = perc
        application.current_step = step
        application.save()

        ApplicationStatusHistory.objects.create(
            application=application,
            from_status=None,
            to_status=ApplicationStatus.DRAFT,
            changed_by=user,
            reason="Application draft created.",
        )

        return application

    @classmethod
    @transaction.atomic
    def submit(cls, user: Any, application_id: uuid.UUID) -> Application:
        application = cls.get_for_user(user, application_id)
        ApplicantService.check_modify(user, application.applicant)

        RegistrationAvailabilityService.assert_can_submit(application.admission_period)

        perc, step = ApplicationCompletionCalculator.calculate(application)
        application.completion_percentage = perc
        application.current_step = step

        if application.applicant.guardians.count() < 1:
            raise ValidationError(
                {"detail": "Application cannot be submitted without at least one guardian."}
            )

        if not application.applicant.full_name or not application.applicant.address:
            raise ValidationError(
                {"detail": "Application cannot be submitted with missing applicant fields."}
            )

        required_reqs = DocumentRequirement.objects.filter(
            models.Q(admission_period=application.admission_period)
            | models.Q(admission_period__isnull=True),
            is_required=True,
            is_active=True,
        )
        if required_reqs.exists():
            uploaded_req_ids = set(
                ApplicationDocument.objects.filter(application=application).values_list(
                    "requirement_id", flat=True
                )
            )
            missing_reqs = [req for req in required_reqs if req.id not in uploaded_req_ids]
            if missing_reqs:
                missing_names = ", ".join([req.name for req in missing_reqs])
                raise ValidationError(
                    {"detail": f"Application missing required documents: {missing_names}."}
                )

        return ApplicationStateMachineService.transition(
            user=user,
            application=application,
            to_status=ApplicationStatus.SUBMITTED,
            reason="Submitted by applicant owner.",
        )


class DocumentRequirementService:
    """Service governing DocumentRequirement management for admins."""

    @classmethod
    def list_requirements(
        cls, period_id: uuid.UUID | None = None
    ) -> models.QuerySet[DocumentRequirement]:
        queryset = DocumentRequirement.objects.filter(is_active=True)
        if period_id:
            queryset = queryset.filter(
                models.Q(admission_period_id=period_id) | models.Q(admission_period__isnull=True)
            )
        return queryset

    @classmethod
    def create(cls, validated_data: dict[str, Any]) -> DocumentRequirement:
        period_id = validated_data.pop("admission_period_id", None)
        period = None
        if period_id:
            try:
                period = AdmissionPeriod.objects.get(pk=period_id)
            except AdmissionPeriod.DoesNotExist as exc:
                raise NotFound({"admission_period_id": "Admission period not found."}) from exc

        code = validated_data.get("code")
        if DocumentRequirement.objects.filter(admission_period=period, code__iexact=code).exists():
            raise ValidationError(
                {"code": f"Document requirement '{code}' already exists for this period."}
            )

        return DocumentRequirement.objects.create(admission_period=period, **validated_data)

    @classmethod
    def update(
        cls, instance: DocumentRequirement, validated_data: dict[str, Any]
    ) -> DocumentRequirement:
        new_code = validated_data.get("code")
        if new_code and new_code != instance.code:
            if (
                DocumentRequirement.objects.filter(
                    admission_period=instance.admission_period, code__iexact=new_code
                )
                .exclude(pk=instance.pk)
                .exists()
            ):
                raise ValidationError(
                    {"code": f"Document requirement '{new_code}' already exists."}
                )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    @classmethod
    def delete(cls, instance: DocumentRequirement) -> None:
        if instance.application_documents.exists():
            instance.is_active = False
            instance.save()
        else:
            instance.delete()


class DocumentService:
    """Service governing Document upload, validation, signed download, verification, and revision.

    Provides versioning and private storage integration.
    """

    @classmethod
    @transaction.atomic
    def upload_document(
        cls,
        user: Any,
        application_id: uuid.UUID,
        requirement_id: uuid.UUID,
        file_obj: Any,
    ) -> ApplicationDocument:
        application = ApplicationService.get_for_user(user, application_id)
        ApplicantService.check_modify(user, application.applicant)

        try:
            requirement = DocumentRequirement.objects.get(pk=requirement_id, is_active=True)
        except DocumentRequirement.DoesNotExist as exc:
            raise NotFound(
                {"requirement_id": "Document requirement not found or inactive."}
            ) from exc

        # 1. Validate file size
        if hasattr(file_obj, "size"):
            file_size = file_obj.size
        else:
            file_size = len(file_obj.read() if hasattr(file_obj, "read") else b"")

        if hasattr(file_obj, "seek"):
            file_obj.seek(0)

        if requirement.max_file_size_bytes and file_size > requirement.max_file_size_bytes:
            max_mb = requirement.max_file_size_bytes / (1024 * 1024)
            raise ValidationError({"file": f"File size exceeds maximum limit of {max_mb:.1f} MB."})

        # 2. Validate MIME type
        content_type = getattr(file_obj, "content_type", "application/octet-stream")
        allowed_mimes = requirement.allowed_mime_types or []
        if allowed_mimes and content_type not in allowed_mimes:
            raise ValidationError({"file": f"MIME type '{content_type}' is not allowed."})

        # 3. Read content & calculate SHA256 checksum
        content = file_obj.read() if hasattr(file_obj, "read") else b""
        checksum = hashlib.sha256(content).hexdigest()

        # 4. Put object into private ObjectStorage
        storage = get_storage()
        storage_key = storage.put(content, mime_type=content_type)

        # 5. Versioning
        existing_doc = (
            ApplicationDocument.objects.filter(application=application, requirement=requirement)
            .order_by("-version")
            .first()
        )
        new_version = (existing_doc.version + 1) if existing_doc else 1

        if existing_doc:
            DocumentRevision.objects.filter(
                application_document=existing_doc, resolved_at__isnull=True
            ).update(resolved_at=timezone.now())

        original_filename = getattr(file_obj, "name", "document")

        document = ApplicationDocument.objects.create(
            application=application,
            requirement=requirement,
            storage_key=storage_key,
            original_filename=original_filename,
            mime_type=content_type,
            file_size=file_size,
            checksum=checksum,
            status=ApplicationDocumentStatus.PENDING,
            version=new_version,
        )

        perc, step = ApplicationCompletionCalculator.calculate(application)
        application.completion_percentage = perc
        application.current_step = step
        application.save()

        return document

    @classmethod
    def get_document_file(
        cls, user: Any, document_id: uuid.UUID
    ) -> tuple[ApplicationDocument, Any]:
        try:
            document = ApplicationDocument.objects.select_related(
                "application__applicant", "requirement"
            ).get(pk=document_id)
        except ApplicationDocument.DoesNotExist as exc:
            raise NotFound({"detail": "Document not found."}) from exc

        ApplicantService.check_access(user, document.application.applicant)

        storage = get_storage()
        if not storage.exists(document.storage_key):
            raise NotFound({"detail": "Storage object not found."})

        file_stream = storage.open(document.storage_key)
        return document, file_stream

    @classmethod
    @transaction.atomic
    def verify_document(
        cls,
        user: Any,
        document_id: uuid.UUID,
        is_valid: bool,
        verification_note: str | None = None,
    ) -> ApplicationDocument:
        try:
            document = ApplicationDocument.objects.select_related("application").get(pk=document_id)
        except ApplicationDocument.DoesNotExist as exc:
            raise NotFound({"detail": "Document not found."}) from exc

        document.status = (
            ApplicationDocumentStatus.VALID if is_valid else ApplicationDocumentStatus.INVALID
        )
        document.verified_at = timezone.now()
        document.verified_by = user
        document.verification_note = verification_note
        document.save()
        return document

    @classmethod
    @transaction.atomic
    def request_revision(
        cls, user: Any, document_id: uuid.UUID, reason: str
    ) -> ApplicationDocument:
        try:
            document = ApplicationDocument.objects.select_related("application").get(pk=document_id)
        except ApplicationDocument.DoesNotExist as exc:
            raise NotFound({"detail": "Document not found."}) from exc

        document.status = ApplicationDocumentStatus.REVISION_REQUIRED
        document.verification_note = reason
        document.save()

        DocumentRevision.objects.create(
            application_document=document,
            requested_by=user,
            reason=reason,
        )

        app = document.application
        if app.status == ApplicationStatus.UNDER_VERIFICATION:
            ApplicationStateMachineService.transition(
                user=user,
                application=app,
                to_status=ApplicationStatus.REVISION_REQUIRED,
                reason=f"Document revision requested: {reason}",
            )

        return document
