"""Serializers for Selection & Assessment domain (F9)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.selection.models import (
    ApplicationDecision,
    ApplicationDecisionType,
    ApplicationScore,
    Assessment,
    AssessmentSchedule,
    DecisionHistory,
    SelectionComponent,
    WaitingListEntry,
)


class SelectionComponentSerializer(serializers.ModelSerializer[SelectionComponent]):
    admission_period_id = serializers.UUIDField(source="admission_period.id", read_only=True)
    period_name = serializers.CharField(source="admission_period.name", read_only=True)

    class Meta:
        model = SelectionComponent
        fields = [
            "id",
            "admission_period_id",
            "period_name",
            "name",
            "code",
            "description",
            "weight",
            "max_score",
            "minimum_score",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SelectionComponentCreateSerializer(serializers.ModelSerializer[SelectionComponent]):
    admission_period_id = serializers.UUIDField()

    class Meta:
        model = SelectionComponent
        fields = [
            "admission_period_id",
            "name",
            "code",
            "description",
            "weight",
            "max_score",
            "minimum_score",
            "sort_order",
            "is_active",
        ]

    def validate_weight(self, value: Decimal) -> Decimal:
        if value < Decimal("0.00") or value > Decimal("100.00"):
            raise serializers.ValidationError("Weight must be between 0 and 100.")
        return value


class SelectionComponentUpdateSerializer(serializers.ModelSerializer[SelectionComponent]):
    name = serializers.CharField(required=False)
    code = serializers.CharField(required=False)
    description = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    weight = serializers.DecimalField(max_digits=5, decimal_places=2, required=False)
    max_score = serializers.DecimalField(max_digits=8, decimal_places=2, required=False)
    minimum_score = serializers.DecimalField(
        max_digits=8, decimal_places=2, required=False, allow_null=True
    )
    sort_order = serializers.IntegerField(required=False)
    is_active = serializers.BooleanField(required=False)

    class Meta:
        model = SelectionComponent
        fields = [
            "name",
            "code",
            "description",
            "weight",
            "max_score",
            "minimum_score",
            "sort_order",
            "is_active",
        ]

    def validate_weight(self, value: Decimal) -> Decimal:
        if value < Decimal("0.00") or value > Decimal("100.00"):
            raise serializers.ValidationError("Weight must be between 0 and 100.")
        return value


class AssessmentScheduleSerializer(serializers.ModelSerializer[AssessmentSchedule]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    registration_number = serializers.CharField(
        source="application.registration_number", read_only=True
    )
    applicant_name = serializers.CharField(source="application.applicant.full_name", read_only=True)
    component_id = serializers.UUIDField(source="component.id", read_only=True)
    component_name = serializers.CharField(source="component.name", read_only=True)
    component_code = serializers.CharField(source="component.code", read_only=True)

    class Meta:
        model = AssessmentSchedule
        fields = [
            "id",
            "application_id",
            "registration_number",
            "applicant_name",
            "component_id",
            "component_name",
            "component_code",
            "scheduled_at",
            "location",
            "room",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AssessmentScheduleCreateSerializer(serializers.Serializer[dict[str, Any]]):
    application_id = serializers.UUIDField()
    component_id = serializers.UUIDField()
    scheduled_at = serializers.DateTimeField()
    location = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    room = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class AssessmentSerializer(serializers.ModelSerializer[Assessment]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    component_id = serializers.UUIDField(source="component.id", read_only=True)
    component_name = serializers.CharField(source="component.name", read_only=True)
    component_code = serializers.CharField(source="component.code", read_only=True)
    assessor_id = serializers.UUIDField(source="assessor.id", read_only=True)
    assessor_name = serializers.CharField(source="assessor.name", read_only=True)

    class Meta:
        model = Assessment
        fields = [
            "id",
            "application_id",
            "component_id",
            "component_name",
            "component_code",
            "assessor_id",
            "assessor_name",
            "score",
            "weighted_score",
            "notes",
            "assessed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AssessmentInputSerializer(serializers.Serializer[dict[str, Any]]):
    application_id = serializers.UUIDField()
    component_id = serializers.UUIDField()
    score = serializers.DecimalField(max_digits=8, decimal_places=2)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class ApplicationScoreSerializer(serializers.ModelSerializer[ApplicationScore]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    registration_number = serializers.CharField(
        source="application.registration_number", read_only=True
    )
    applicant_name = serializers.CharField(source="application.applicant.full_name", read_only=True)
    assessments = AssessmentSerializer(source="application.assessments", many=True, read_only=True)

    class Meta:
        model = ApplicationScore
        fields = [
            "id",
            "application_id",
            "registration_number",
            "applicant_name",
            "raw_score",
            "final_score",
            "rank",
            "calculated_at",
            "assessments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DecisionHistorySerializer(serializers.ModelSerializer[DecisionHistory]):
    changed_by_id = serializers.UUIDField(source="changed_by.id", read_only=True)
    changed_by_name = serializers.CharField(source="changed_by.name", read_only=True)

    class Meta:
        model = DecisionHistory
        fields = [
            "id",
            "application_decision_id",
            "old_decision",
            "new_decision",
            "changed_by_id",
            "changed_by_name",
            "reason",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ApplicationDecisionSerializer(serializers.ModelSerializer[ApplicationDecision]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    registration_number = serializers.CharField(
        source="application.registration_number", read_only=True
    )
    applicant_name = serializers.CharField(source="application.applicant.full_name", read_only=True)
    decided_by_id = serializers.UUIDField(source="decided_by.id", read_only=True)
    decided_by_name = serializers.CharField(source="decided_by.name", read_only=True)
    histories = DecisionHistorySerializer(many=True, read_only=True)

    class Meta:
        model = ApplicationDecision
        fields = [
            "id",
            "application_id",
            "registration_number",
            "applicant_name",
            "decision",
            "final_score",
            "rank",
            "decided_by_id",
            "decided_by_name",
            "reason",
            "published_at",
            "histories",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class DecisionInputSerializer(serializers.Serializer[dict[str, Any]]):
    decision = serializers.ChoiceField(choices=ApplicationDecisionType.choices)
    reason = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class WaitingListEntrySerializer(serializers.ModelSerializer[WaitingListEntry]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    registration_number = serializers.CharField(
        source="application.registration_number", read_only=True
    )
    applicant_name = serializers.CharField(source="application.applicant.full_name", read_only=True)
    promoted_by_id = serializers.UUIDField(source="promoted_by.id", read_only=True, allow_null=True)
    promoted_by_name = serializers.CharField(
        source="promoted_by.name", read_only=True, allow_null=True
    )

    class Meta:
        model = WaitingListEntry
        fields = [
            "id",
            "application_id",
            "registration_number",
            "applicant_name",
            "position",
            "score",
            "status",
            "promoted_at",
            "promoted_by_id",
            "promoted_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class WaitingListPromotionSerializer(serializers.Serializer[dict[str, Any]]):
    reason = serializers.CharField(required=True)


class AnnouncementPublishSerializer(serializers.Serializer[dict[str, Any]]):
    published_at = serializers.DateTimeField(required=False, allow_null=True)


class AnnouncementResultSerializer(serializers.Serializer[dict[str, Any]]):
    is_published = serializers.BooleanField()
    message = serializers.CharField(required=False, allow_null=True)
    application_id = serializers.UUIDField(required=False)
    registration_number = serializers.CharField(required=False, allow_null=True)
    applicant_name = serializers.CharField(required=False, allow_null=True)
    admission_period_name = serializers.CharField(required=False, allow_null=True)
    decision = serializers.CharField(required=False, allow_null=True)
    final_score = serializers.DecimalField(
        max_digits=12, decimal_places=4, required=False, allow_null=True
    )
    rank = serializers.IntegerField(required=False, allow_null=True)
    published_at = serializers.DateTimeField(required=False, allow_null=True)
    announcement_at = serializers.DateTimeField(required=False, allow_null=True)
    next_steps = serializers.ListField(child=serializers.CharField(), required=False)
    letter_url = serializers.CharField(required=False, allow_null=True)


class AnnouncementPublicLookupSerializer(serializers.Serializer[dict[str, Any]]):
    registration_number = serializers.CharField(required=True)
    birth_date = serializers.DateField(required=True)

