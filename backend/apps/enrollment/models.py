"""Enrollment and Re-registration domain models (F12)."""

from __future__ import annotations

from django.db import models

from apps.admission.models import AdmissionPeriod, Application
from apps.common.models import BaseModel


class ReRegistrationStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    EXPIRED = "EXPIRED", "Expired"


class ReRegistration(BaseModel):
    """Re-registration process tracking for accepted candidates."""

    application = models.OneToOneField(
        Application,
        on_delete=models.CASCADE,
        related_name="re_registration",
    )
    status = models.CharField(
        max_length=30,
        choices=ReRegistrationStatus.choices,
        default=ReRegistrationStatus.PENDING,
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "re_registrations"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="ix_re_reg_status"),
        ]

    def __str__(self) -> str:
        return f"ReRegistration: App {self.application_id} ({self.status})"


class ReRegistrationRequirement(BaseModel):
    """Configurable re-registration requirements per admission period."""

    admission_period = models.ForeignKey(
        AdmissionPeriod,
        on_delete=models.CASCADE,
        related_name="re_registration_requirements",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=100)
    is_required = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)

    class Meta:
        db_table = "re_registration_requirements"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["admission_period", "code"],
                name="uq_re_reg_req_period_code",
            ),
        ]
        indexes = [
            models.Index(fields=["admission_period"], name="ix_re_reg_req_period_id"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class ReRegistrationItemStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    COMPLETED = "COMPLETED", "Completed"
    WAIVED = "WAIVED", "Waived"


class ReRegistrationItem(BaseModel):
    """Specific item completion status for a re-registration record."""

    re_registration = models.ForeignKey(
        ReRegistration,
        on_delete=models.CASCADE,
        related_name="items",
    )
    requirement = models.ForeignKey(
        ReRegistrationRequirement,
        on_delete=models.CASCADE,
        related_name="items",
    )
    status = models.CharField(
        max_length=30,
        choices=ReRegistrationItemStatus.choices,
        default=ReRegistrationItemStatus.PENDING,
    )
    notes = models.TextField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "re_registration_items"
        ordering = ["requirement__sort_order"]
        constraints = [
            models.UniqueConstraint(
                fields=["re_registration", "requirement"],
                name="uq_re_reg_item_re_reg_req",
            ),
        ]
        indexes = [
            models.Index(fields=["re_registration"], name="ix_re_reg_item_reg_id"),
            models.Index(fields=["requirement"], name="ix_re_reg_item_req_id"),
        ]

    def __str__(self) -> str:
        return f"Item: {self.requirement.name} = {self.status}"
