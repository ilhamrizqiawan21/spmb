"""Verification domain models for verifier assignments and review tracking."""

from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.admission.models import Application
from apps.common.models import BaseModel


class VerificationReviewStatus(models.TextChoices):
    PENDING = "PENDING", "Pending Review"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    REVISION_REQUIRED = "REVISION_REQUIRED", "Revision Required"
    VERIFIED = "VERIFIED", "Verified"
    REJECTED = "REJECTED", "Rejected"


class VerificationAssignment(BaseModel):
    """Tracks assignment of applications to specific verifiers for work queue processing."""

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="verification_assignments",
    )
    verifier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="verification_assignments",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_verifications",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "verification_assignments"
        ordering = ["-assigned_at"]
        indexes = [
            models.Index(fields=["application"], name="ix_verif_assign_app_id"),
            models.Index(fields=["verifier"], name="ix_verif_assign_verifier_id"),
            models.Index(fields=["completed_at"], name="ix_verif_assign_completed"),
        ]

    def __str__(self) -> str:
        return f"Assignment: App {self.application_id} -> Verifier {self.verifier_id}"


class VerificationReview(BaseModel):
    """Records overall verification review decisions, timestamps, and notes."""

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="verification_reviews",
    )
    verifier = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="performed_verification_reviews",
    )
    status = models.CharField(
        max_length=30,
        choices=VerificationReviewStatus.choices,
        default=VerificationReviewStatus.PENDING,
    )
    notes = models.TextField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "verification_reviews"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application"], name="ix_verif_review_app_id"),
            models.Index(fields=["verifier"], name="ix_verif_review_verifier_id"),
            models.Index(fields=["status"], name="ix_verif_review_status"),
        ]

    def __str__(self) -> str:
        return f"Review: App {self.application_id} ({self.status})"
