"""Domain services for Enrollment and Re-registration (F12)."""

from __future__ import annotations

import uuid
from typing import Any

from django.db import models, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

from apps.admission.models import AdmissionPeriod, Application, ApplicationStatus
from apps.admission.services import ApplicantService, ApplicationStateMachineService
from apps.enrollment.models import (
    ReRegistration,
    ReRegistrationItem,
    ReRegistrationItemStatus,
    ReRegistrationRequirement,
    ReRegistrationStatus,
)


class ReRegistrationRequirementService:
    """Service governing ReRegistrationRequirement configuration."""

    @classmethod
    def list_for_period(
        cls, period_id: uuid.UUID | None = None
    ) -> models.QuerySet[ReRegistrationRequirement]:
        queryset = ReRegistrationRequirement.objects.all()
        if period_id:
            queryset = queryset.filter(admission_period_id=period_id)
        return queryset.order_by("sort_order", "name")

    @classmethod
    @transaction.atomic
    def create(cls, validated_data: dict[str, Any]) -> ReRegistrationRequirement:
        period_id = validated_data.pop("admission_period_id")
        try:
            period = AdmissionPeriod.objects.get(pk=period_id)
        except AdmissionPeriod.DoesNotExist as exc:
            raise NotFound({"admission_period_id": "Admission period not found."}) from exc

        code = validated_data.get("code")
        if ReRegistrationRequirement.objects.filter(
            admission_period=period, code__iexact=code
        ).exists():
            raise ValidationError(
                {"code": f"Requirement code '{code}' already exists for this period."}
            )

        return ReRegistrationRequirement.objects.create(admission_period=period, **validated_data)

    @classmethod
    @transaction.atomic
    def update(
        cls, instance: ReRegistrationRequirement, validated_data: dict[str, Any]
    ) -> ReRegistrationRequirement:
        new_code = validated_data.get("code")
        if new_code and new_code != instance.code:
            if (
                ReRegistrationRequirement.objects.filter(
                    admission_period=instance.admission_period, code__iexact=new_code
                )
                .exclude(pk=instance.pk)
                .exists()
            ):
                raise ValidationError({"code": f"Requirement code '{new_code}' already exists."})

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

    @classmethod
    def delete(cls, instance: ReRegistrationRequirement) -> None:
        if instance.items.exists():
            raise ValidationError(
                {"detail": "Cannot delete requirement that has existing re-registration items."}
            )
        instance.delete()


class ReRegistrationService:
    """Service governing ReRegistration lifecycles, items, and verification."""

    @classmethod
    @transaction.atomic
    def start_re_registration(
        cls,
        user: Any,
        application_id: uuid.UUID,
    ) -> ReRegistration:
        try:
            application = (
                Application.objects.select_related("applicant", "admission_period")
                .prefetch_related("re_registration")
                .get(pk=application_id)
            )
        except Application.DoesNotExist as exc:
            raise NotFound({"detail": "Application not found."}) from exc

        ApplicantService.check_modify(user, application.applicant)

        existing = getattr(application, "re_registration", None)
        if existing:
            return existing

        if application.status != ApplicationStatus.ACCEPTED:
            raise ValidationError(
                {
                    "detail": (
                        "Only ACCEPTED applications can start re-registration. "
                        f"Current status: '{application.status}'."
                    )
                }
            )

        now = timezone.now()
        re_reg = ReRegistration.objects.create(
            application=application,
            status=ReRegistrationStatus.IN_PROGRESS,
            confirmed_at=now,
        )

        requirements = ReRegistrationRequirement.objects.filter(
            admission_period=application.admission_period
        )
        items_to_create = [
            ReRegistrationItem(
                re_registration=re_reg,
                requirement=req,
                status=ReRegistrationItemStatus.PENDING,
            )
            for req in requirements
        ]
        if items_to_create:
            ReRegistrationItem.objects.bulk_create(items_to_create)

        ApplicationStateMachineService.transition(
            user=user,
            application=application,
            to_status=ApplicationStatus.RE_REGISTRATION,
            reason="Started re-registration process.",
        )

        return re_reg

    @classmethod
    def get_for_application(
        cls,
        user: Any,
        application_id: uuid.UUID,
    ) -> ReRegistration:
        try:
            re_reg = (
                ReRegistration.objects.select_related("application__applicant")
                .prefetch_related("items__requirement")
                .get(application_id=application_id)
            )
        except ReRegistration.DoesNotExist as exc:
            raise NotFound(
                {"detail": "Re-registration record not found for this application."}
            ) from exc

        ApplicantService.check_access(user, re_reg.application.applicant)
        return re_reg

    @classmethod
    @transaction.atomic
    def update_item(
        cls,
        user: Any,
        item_id: uuid.UUID,
        item_status: str,
        notes: str | None = None,
    ) -> ReRegistrationItem:
        try:
            item = (
                ReRegistrationItem.objects.select_related(
                    "re_registration__application__applicant", "requirement"
                ).get(pk=item_id)
            )
        except ReRegistrationItem.DoesNotExist as exc:
            raise NotFound({"detail": "Re-registration item not found."}) from exc

        ApplicantService.check_modify(user, item.re_registration.application.applicant)

        if item_status not in ReRegistrationItemStatus.values:
            raise ValidationError({"status": f"Invalid item status '{item_status}'."})

        item.status = item_status
        item.notes = notes
        if item_status in [ReRegistrationItemStatus.COMPLETED, ReRegistrationItemStatus.WAIVED]:
            item.completed_at = timezone.now()
        else:
            item.completed_at = None

        item.save()
        return item

    @classmethod
    @transaction.atomic
    def complete_re_registration(
        cls,
        user: Any,
        re_registration_id: uuid.UUID,
    ) -> ReRegistration:
        try:
            re_reg = (
                ReRegistration.objects.select_related("application__applicant")
                .prefetch_related("items__requirement")
                .get(pk=re_registration_id)
            )
        except ReRegistration.DoesNotExist as exc:
            raise NotFound({"detail": "Re-registration record not found."}) from exc

        has_perm = getattr(user, "has_any_perm_codes", None)
        perm_codes = ["enrollment.manage", "application.override"]
        if not (callable(has_perm) and user.has_any_perm_codes(perm_codes)):
            ApplicantService.check_modify(user, re_reg.application.applicant)

        valid_done_statuses = [
            ReRegistrationItemStatus.COMPLETED,
            ReRegistrationItemStatus.WAIVED,
        ]
        incomplete_mandatory = [
            item
            for item in re_reg.items.all()
            if item.requirement.is_required and item.status not in valid_done_statuses
        ]
        if incomplete_mandatory:
            missing_names = ", ".join([item.requirement.name for item in incomplete_mandatory])
            raise ValidationError(
                {
                    "detail": (
                        "Cannot complete re-registration: "
                        f"mandatory items incomplete ({missing_names})."
                    )
                }
            )

        now = timezone.now()
        re_reg.status = ReRegistrationStatus.COMPLETED
        re_reg.completed_at = now
        re_reg.save()

        ApplicationStateMachineService.transition(
            user=user,
            application=re_reg.application,
            to_status=ApplicationStatus.RE_REGISTRATION_VERIFIED,
            reason="Re-registration completed and verified.",
        )

        return re_reg
