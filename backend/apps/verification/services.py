"""Domain services for Verification Center work queue and review workflows (F8)."""

from __future__ import annotations

import uuid
from typing import Any

from django.contrib.auth import get_user_model
from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.admission.models import (
    Application,
    ApplicationDocumentStatus,
    ApplicationStatus,
    DocumentRequirement,
)
from apps.admission.services import ApplicationStateMachineService
from apps.verification.models import (
    VerificationAssignment,
    VerificationReview,
)

User = get_user_model()


class VerificationAssignmentService:
    """Service governing manual/automatic assignment of applications to verifiers."""

    @classmethod
    @transaction.atomic
    def assign(
        cls, assigned_by: Any, application_id: uuid.UUID, verifier_id: uuid.UUID
    ) -> VerificationAssignment:
        try:
            application = Application.objects.select_related("applicant", "admission_period").get(
                pk=application_id
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"application_id": "Application not found."}) from exc

        try:
            verifier = User.objects.get(pk=verifier_id)
        except User.DoesNotExist as exc:
            raise NotFound({"verifier_id": "Verifier user not found."}) from exc

        # Complete any existing incomplete assignment for this application
        VerificationAssignment.objects.filter(
            application=application, completed_at__isnull=True
        ).update(completed_at=timezone.now())

        assignment = VerificationAssignment.objects.create(
            application=application,
            verifier=verifier,
            assigned_by=assigned_by if getattr(assigned_by, "is_authenticated", False) else None,
            assigned_at=timezone.now(),
        )

        if application.status in [ApplicationStatus.SUBMITTED, ApplicationStatus.RESUBMITTED]:
            ApplicationStateMachineService.transition(
                user=assigned_by,
                application=application,
                to_status=ApplicationStatus.UNDER_VERIFICATION,
                reason=f"Assigned to verifier {verifier.name}.",
            )

        return assignment


class VerificationReviewService:
    """Service governing verifier work queue search and application verification completion."""

    @classmethod
    def get_verifier_queue(
        cls,
        user: Any,
        assignment_filter: str | None = None,
        status_filter: str | None = None,
        period_id: uuid.UUID | None = None,
        search: str | None = None,
    ) -> models.QuerySet[Application]:
        queryset = Application.objects.select_related(
            "applicant", "admission_period"
        ).prefetch_related("documents__requirement")

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        else:
            queryset = queryset.filter(
                status__in=[
                    ApplicationStatus.SUBMITTED,
                    ApplicationStatus.UNDER_VERIFICATION,
                    ApplicationStatus.REVISION_REQUIRED,
                    ApplicationStatus.RESUBMITTED,
                    ApplicationStatus.VERIFIED,
                ]
            )

        if period_id:
            queryset = queryset.filter(admission_period_id=period_id)

        if search:
            queryset = queryset.filter(
                models.Q(applicant__full_name__icontains=search)
                | models.Q(registration_number__icontains=search)
            )

        if assignment_filter == "unassigned":
            active_app_ids = VerificationAssignment.objects.filter(
                completed_at__isnull=True
            ).values_list("application_id", flat=True)
            queryset = queryset.exclude(id__in=active_app_ids)
        elif assignment_filter == "assigned_to_me":
            my_app_ids = VerificationAssignment.objects.filter(
                verifier=user, completed_at__isnull=True
            ).values_list("application_id", flat=True)
            queryset = queryset.filter(id__in=my_app_ids)

        queryset = queryset.order_by("-submitted_at", "-created_at")

        # Prefetch active assignment onto each object for serializer efficiency
        active_assignments = {
            a.application_id: a
            for a in VerificationAssignment.objects.filter(
                application__in=queryset, completed_at__isnull=True
            ).select_related("verifier")
        }
        for app in queryset:
            setattr(app, "_active_assignment", active_assignments.get(app.id))

        return queryset

    @classmethod
    @transaction.atomic
    def complete_verification(
        cls,
        user: Any,
        application_id: uuid.UUID,
        to_status: str,
        notes: str | None = None,
    ) -> VerificationReview:
        try:
            application = (
                Application.objects.select_related("applicant", "admission_period")
                .prefetch_related("documents__requirement")
                .get(pk=application_id)
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"detail": "Application not found."}) from exc

        has_perm = getattr(user, "has_any_perm_codes", None)
        perm_codes = ["document.verify", "application.verify", "application.override"]
        if not (callable(has_perm) and user.has_any_perm_codes(perm_codes)):
            raise PermissionDenied({"detail": "You do not have permission to verify applications."})

        if to_status == ApplicationStatus.VERIFIED:
            # 1. Check required document presence
            required_reqs = DocumentRequirement.objects.filter(
                models.Q(admission_period=application.admission_period)
                | models.Q(admission_period__isnull=True),
                is_required=True,
                is_active=True,
            )
            uploaded_docs = list(application.documents.all())
            uploaded_req_ids = {doc.requirement_id for doc in uploaded_docs}

            missing_reqs = [req for req in required_reqs if req.id not in uploaded_req_ids]
            if missing_reqs:
                names = ", ".join([req.name for req in missing_reqs])
                raise ValidationError(
                    {"detail": f"Cannot verify application. Missing required documents: {names}."}
                )

            # 2. Check document statuses (no PENDING, INVALID, or REVISION_REQUIRED documents)
            invalid_or_pending = [
                doc
                for doc in uploaded_docs
                if doc.status
                in [
                    ApplicationDocumentStatus.PENDING,
                    ApplicationDocumentStatus.INVALID,
                    ApplicationDocumentStatus.REVISION_REQUIRED,
                ]
            ]
            if invalid_or_pending:
                raise ValidationError(
                    {
                        "detail": (
                            "Cannot verify application while documents are pending, invalid, or"
                            " require revision."
                        )
                    }
                )

        if application.status in [ApplicationStatus.SUBMITTED, ApplicationStatus.RESUBMITTED]:
            application = ApplicationStateMachineService.transition(
                user=user,
                application=application,
                to_status=ApplicationStatus.UNDER_VERIFICATION,
                reason="Auto-transition to UNDER_VERIFICATION upon review execution.",
            )

        # Transition application state via state machine
        updated_app = ApplicationStateMachineService.transition(
            user=user,
            application=application,
            to_status=to_status,
            reason=notes or f"Verification set to {to_status}.",
        )

        review = VerificationReview.objects.create(
            application=updated_app,
            verifier=user,
            status=to_status,
            notes=notes,
            started_at=timezone.now(),
            completed_at=timezone.now(),
        )

        VerificationAssignment.objects.filter(
            application=updated_app, completed_at__isnull=True
        ).update(completed_at=timezone.now())

        return review
