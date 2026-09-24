"""Serializers for Verification Center (F8)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.admission.models import Application, ApplicationDocumentStatus
from apps.verification.models import (
    VerificationAssignment,
    VerificationReview,
    VerificationReviewStatus,
)


class VerificationAssignmentSerializer(serializers.ModelSerializer[VerificationAssignment]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    registration_number = serializers.CharField(
        source="application.registration_number", read_only=True
    )
    applicant_name = serializers.CharField(source="application.applicant.full_name", read_only=True)
    verifier_id = serializers.UUIDField(source="verifier.id", read_only=True)
    verifier_name = serializers.CharField(source="verifier.name", read_only=True)
    assigned_by_id = serializers.UUIDField(source="assigned_by.id", read_only=True, allow_null=True)
    assigned_by_name = serializers.CharField(
        source="assigned_by.name", read_only=True, allow_null=True
    )

    class Meta:
        model = VerificationAssignment
        fields = [
            "id",
            "application_id",
            "registration_number",
            "applicant_name",
            "verifier_id",
            "verifier_name",
            "assigned_by_id",
            "assigned_by_name",
            "assigned_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class VerificationAssignmentCreateSerializer(serializers.Serializer[dict[str, Any]]):
    application_id = serializers.UUIDField()
    verifier_id = serializers.UUIDField()


class VerificationReviewSerializer(serializers.ModelSerializer[VerificationReview]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    verifier_id = serializers.UUIDField(source="verifier.id", read_only=True)
    verifier_name = serializers.CharField(source="verifier.name", read_only=True)

    class Meta:
        model = VerificationReview
        fields = [
            "id",
            "application_id",
            "verifier_id",
            "verifier_name",
            "status",
            "notes",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class VerificationCompleteSerializer(serializers.Serializer[dict[str, Any]]):
    to_status = serializers.ChoiceField(
        choices=[
            VerificationReviewStatus.VERIFIED,
            VerificationReviewStatus.REVISION_REQUIRED,
            VerificationReviewStatus.REJECTED,
        ]
    )
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class VerificationQueueItemSerializer(serializers.ModelSerializer[Application]):
    applicant_id = serializers.UUIDField(source="applicant.id", read_only=True)
    applicant_name = serializers.CharField(source="applicant.full_name", read_only=True)
    period_id = serializers.UUIDField(source="admission_period.id", read_only=True)
    period_name = serializers.CharField(source="admission_period.name", read_only=True)

    assigned_verifier_id = serializers.SerializerMethodField()
    assigned_verifier_name = serializers.SerializerMethodField()

    document_counts = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = [
            "id",
            "applicant_id",
            "applicant_name",
            "period_id",
            "period_name",
            "registration_number",
            "status",
            "submitted_at",
            "assigned_verifier_id",
            "assigned_verifier_name",
            "document_counts",
            "completion_percentage",
            "created_at",
            "updated_at",
        ]

    def get_assigned_verifier_id(self, obj: Application) -> str | None:
        active_assignment = getattr(obj, "_active_assignment", None)
        if active_assignment and active_assignment.verifier_id:
            return str(active_assignment.verifier_id)
        return None

    def get_assigned_verifier_name(self, obj: Application) -> str | None:
        active_assignment = getattr(obj, "_active_assignment", None)
        if active_assignment and active_assignment.verifier:
            return active_assignment.verifier.name

        return None

    def get_document_counts(self, obj: Application) -> dict[str, int]:
        docs = list(obj.documents.all())
        total = len(docs)

        pending = sum(1 for d in docs if d.status == ApplicationDocumentStatus.PENDING)
        valid = sum(1 for d in docs if d.status == ApplicationDocumentStatus.VALID)
        invalid = sum(1 for d in docs if d.status == ApplicationDocumentStatus.INVALID)
        revision_required = sum(
            1 for d in docs if d.status == ApplicationDocumentStatus.REVISION_REQUIRED
        )
        return {
            "total": total,
            "pending": pending,
            "valid": valid,
            "invalid": invalid,
            "revision_required": revision_required,
        }
