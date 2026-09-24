"""Selection & Assessment domain models (F9)."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.admission.models import AdmissionPeriod, Application
from apps.common.models import BaseModel


class SelectionComponent(BaseModel):
    """Configurable scoring component per admission period (e.g. Tes Tulis, Wawancara)."""

    admission_period = models.ForeignKey(
        AdmissionPeriod,
        on_delete=models.CASCADE,
        related_name="selection_components",
    )
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)

    weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("100.00"))],
        help_text="Percentage weight of this component (0-100).",
    )
    max_score = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=Decimal("100.00"),
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    minimum_score = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "selection_components"
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["admission_period", "code"],
                name="uq_selection_comp_period_code",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(weight__gte=Decimal("0.00")) & models.Q(weight__lte=Decimal("100.00"))
                ),
                name="ck_selection_comp_weight_range",
            ),
        ]

        indexes = [
            models.Index(fields=["admission_period"], name="ix_sel_comp_period_id"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.code}) - {self.weight}%"


class AssessmentScheduleStatus(models.TextChoices):
    SCHEDULED = "SCHEDULED", "Scheduled"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    NO_SHOW = "NO_SHOW", "No Show"


class AssessmentSchedule(BaseModel):
    """Schedules an applicant for a specific assessment component."""

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="assessment_schedules",
    )
    component = models.ForeignKey(
        SelectionComponent,
        on_delete=models.CASCADE,
        related_name="schedules",
    )
    scheduled_at = models.DateTimeField()
    location = models.CharField(max_length=255, null=True, blank=True)
    room = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    status = models.CharField(
        max_length=30,
        choices=AssessmentScheduleStatus.choices,
        default=AssessmentScheduleStatus.SCHEDULED,
    )

    class Meta:
        db_table = "assessment_schedules"
        ordering = ["scheduled_at"]
        indexes = [
            models.Index(fields=["application"], name="ix_ass_sched_app_id"),
            models.Index(fields=["component"], name="ix_ass_sched_comp_id"),
            models.Index(fields=["scheduled_at"], name="ix_ass_sched_time"),
        ]

    def __str__(self) -> str:
        return f"Schedule: App {self.application_id} - {self.component.name}"


class Assessment(BaseModel):
    """Individual score input per component given by an assessor."""

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    component = models.ForeignKey(
        SelectionComponent,
        on_delete=models.CASCADE,
        related_name="assessments",
    )
    assessor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="given_assessments",
    )

    score = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    weighted_score = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        null=True,
        blank=True,
    )
    notes = models.TextField(null=True, blank=True)
    assessed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assessments"
        ordering = ["-assessed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["application", "component"],
                name="uq_assessments_app_component",
            ),
        ]
        indexes = [
            models.Index(fields=["application"], name="ix_ass_app_id"),
            models.Index(fields=["component"], name="ix_ass_comp_id"),
            models.Index(fields=["assessor"], name="ix_ass_assessor_id"),
        ]

    def __str__(self) -> str:
        return f"Assessment: App {self.application_id} [{self.component.code}] = {self.score}"


class ApplicationScore(BaseModel):
    """Aggregated final score summary and rank for an application."""

    application = models.OneToOneField(
        Application,
        on_delete=models.CASCADE,
        related_name="score_summary",
    )
    raw_score = models.DecimalField(max_digits=12, decimal_places=4)
    final_score = models.DecimalField(max_digits=12, decimal_places=4)
    rank = models.IntegerField(null=True, blank=True)
    calculated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "application_scores"
        ordering = ["-final_score", "rank"]
        indexes = [
            models.Index(fields=["final_score"], name="ix_app_scores_final"),
            models.Index(fields=["rank"], name="ix_app_scores_rank"),
        ]

    def __str__(self) -> str:
        return f"AppScore: App {self.application_id} = {self.final_score} (Rank: {self.rank})"


class ApplicationDecisionType(models.TextChoices):
    ACCEPTED = "ACCEPTED", "Accepted"
    WAITLISTED = "WAITLISTED", "Waitlisted"
    REJECTED = "REJECTED", "Rejected"


class ApplicationDecision(BaseModel):
    """Final admission decision record per application."""

    application = models.OneToOneField(
        Application,
        on_delete=models.CASCADE,
        related_name="decision",
    )
    decision = models.CharField(max_length=30, choices=ApplicationDecisionType.choices)
    final_score = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    rank = models.IntegerField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="decided_applications",
    )
    reason = models.TextField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "application_decisions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["decision"], name="ix_app_decision_type"),
            models.Index(fields=["decided_by"], name="ix_app_decision_by"),
        ]

    def __str__(self) -> str:
        return f"Decision: App {self.application_id} -> {self.decision}"


class WaitingListStatus(models.TextChoices):
    WAITING = "WAITING", "Waiting"
    PROMOTED = "PROMOTED", "Promoted"
    EXPIRED = "EXPIRED", "Expired"
    CANCELLED = "CANCELLED", "Cancelled"


class WaitingListEntry(BaseModel):
    """Tracks waiting list position and promotion status for waitlisted applicants."""

    application = models.OneToOneField(
        Application,
        on_delete=models.CASCADE,
        related_name="waiting_list_entry",
    )
    position = models.IntegerField()
    score = models.DecimalField(max_digits=12, decimal_places=4)
    status = models.CharField(
        max_length=30,
        choices=WaitingListStatus.choices,
        default=WaitingListStatus.WAITING,
    )
    promoted_at = models.DateTimeField(null=True, blank=True)
    promoted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promoted_waiting_list_entries",
    )

    class Meta:
        db_table = "waiting_list_entries"
        ordering = ["position", "-score"]
        indexes = [
            models.Index(fields=["position"], name="ix_wl_pos"),
            models.Index(fields=["status"], name="ix_wl_status"),
        ]

    def __str__(self) -> str:
        return f"WaitingList Pos {self.position}: App {self.application_id} ({self.status})"


class DecisionHistory(BaseModel):
    """Audit history of decision overrides and changes."""

    application_decision = models.ForeignKey(
        ApplicationDecision,
        on_delete=models.CASCADE,
        related_name="histories",
    )
    old_decision = models.CharField(max_length=30)
    new_decision = models.CharField(max_length=30)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="changed_decision_histories",
    )
    reason = models.TextField()

    class Meta:
        db_table = "decision_histories"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application_decision"], name="ix_dec_hist_dec_id"),
            models.Index(fields=["changed_by"], name="ix_dec_hist_user_id"),
        ]

    def __str__(self) -> str:
        return f"DecisionOverride: {self.old_decision} -> {self.new_decision}"
