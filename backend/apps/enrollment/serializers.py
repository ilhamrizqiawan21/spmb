"""Serializers for Enrollment and Re-registration domain (F12)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from apps.enrollment.models import (
    ReRegistration,
    ReRegistrationItem,
    ReRegistrationItemStatus,
    ReRegistrationRequirement,
)


class ReRegistrationRequirementSerializer(serializers.ModelSerializer[ReRegistrationRequirement]):
    admission_period_id = serializers.UUIDField(source="admission_period.id", read_only=True)
    period_name = serializers.CharField(source="admission_period.name", read_only=True)

    class Meta:
        model = ReRegistrationRequirement
        fields = [
            "id",
            "admission_period_id",
            "period_name",
            "name",
            "code",
            "is_required",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ReRegistrationRequirementCreateSerializer(
    serializers.ModelSerializer[ReRegistrationRequirement]
):
    admission_period_id = serializers.UUIDField()

    class Meta:
        model = ReRegistrationRequirement
        fields = [
            "admission_period_id",
            "name",
            "code",
            "is_required",
            "sort_order",
        ]


class ReRegistrationRequirementUpdateSerializer(
    serializers.ModelSerializer[ReRegistrationRequirement]
):
    name = serializers.CharField(required=False)
    code = serializers.CharField(required=False)
    is_required = serializers.BooleanField(required=False)
    sort_order = serializers.IntegerField(required=False)

    class Meta:
        model = ReRegistrationRequirement
        fields = [
            "name",
            "code",
            "is_required",
            "sort_order",
        ]


class ReRegistrationItemSerializer(serializers.ModelSerializer[ReRegistrationItem]):
    requirement_id = serializers.UUIDField(source="requirement.id", read_only=True)
    requirement_name = serializers.CharField(source="requirement.name", read_only=True)
    requirement_code = serializers.CharField(source="requirement.code", read_only=True)
    is_required = serializers.BooleanField(source="requirement.is_required", read_only=True)

    class Meta:
        model = ReRegistrationItem
        fields = [
            "id",
            "re_registration_id",
            "requirement_id",
            "requirement_name",
            "requirement_code",
            "is_required",
            "status",
            "notes",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class ReRegistrationItemUpdateSerializer(serializers.Serializer[dict[str, Any]]):
    status = serializers.ChoiceField(choices=ReRegistrationItemStatus.choices)
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class ReRegistrationSerializer(serializers.ModelSerializer[ReRegistration]):
    application_id = serializers.UUIDField(source="application.id", read_only=True)
    registration_number = serializers.CharField(
        source="application.registration_number", read_only=True
    )
    applicant_name = serializers.CharField(source="application.applicant.full_name", read_only=True)
    items = ReRegistrationItemSerializer(many=True, read_only=True)

    class Meta:
        model = ReRegistration
        fields = [
            "id",
            "application_id",
            "registration_number",
            "applicant_name",
            "status",
            "confirmed_at",
            "completed_at",
            "notes",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
