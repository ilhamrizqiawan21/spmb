"""API views for Enrollment and Re-registration domain (F12)."""

from __future__ import annotations

import uuid
from typing import Any

from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth.permissions import HasAnyPermissions
from apps.enrollment.models import ReRegistrationRequirement
from apps.enrollment.serializers import (
    ReRegistrationItemSerializer,
    ReRegistrationItemUpdateSerializer,
    ReRegistrationRequirementCreateSerializer,
    ReRegistrationRequirementSerializer,
    ReRegistrationRequirementUpdateSerializer,
    ReRegistrationSerializer,
)
from apps.enrollment.services import (
    ReRegistrationRequirementService,
    ReRegistrationService,
)


class ReRegistrationRequirementListCreateView(APIView):
    """List re-registration requirements or create a new requirement."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [
            IsAuthenticated(),
            HasAnyPermissions(["enrollment.manage", "application.override"])(),
        ]

    def get(self, request: Request) -> Response:
        period_id_str = request.query_params.get("admission_period_id")
        period_id = None
        if period_id_str:
            try:
                period_id = uuid.UUID(period_id_str)
            except ValueError as exc:
                raise NotFound({"admission_period_id": "Invalid period ID format."}) from exc

        reqs = ReRegistrationRequirementService.list_for_period(period_id)
        return Response(ReRegistrationRequirementSerializer(reqs, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ReRegistrationRequirementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req = ReRegistrationRequirementService.create(serializer.validated_data)
        return Response(
            ReRegistrationRequirementSerializer(req).data,
            status=status.HTTP_201_CREATED,
        )


class ReRegistrationRequirementDetailView(APIView):
    """Retrieve, update, or delete a re-registration requirement."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [
            IsAuthenticated(),
            HasAnyPermissions(["enrollment.manage", "application.override"])(),
        ]

    def _get_object(self, pk: uuid.UUID) -> ReRegistrationRequirement:
        try:
            return ReRegistrationRequirement.objects.get(pk=pk)
        except ReRegistrationRequirement.DoesNotExist as exc:
            raise NotFound({"detail": "Re-registration requirement not found."}) from exc

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        req = self._get_object(pk)
        return Response(ReRegistrationRequirementSerializer(req).data)

    def patch(self, request: Request, pk: uuid.UUID) -> Response:
        req = self._get_object(pk)
        serializer = ReRegistrationRequirementUpdateSerializer(req, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = ReRegistrationRequirementService.update(req, serializer.validated_data)
        return Response(ReRegistrationRequirementSerializer(updated).data)

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        req = self._get_object(pk)
        ReRegistrationRequirementService.delete(req)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReRegistrationStartView(APIView):
    """Start re-registration process for an accepted application."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, application_id: uuid.UUID) -> Response:
        re_reg = ReRegistrationService.start_re_registration(
            user=request.user,
            application_id=application_id,
        )
        return Response(
            ReRegistrationSerializer(re_reg).data,
            status=status.HTTP_201_CREATED,
        )


class ReRegistrationDetailView(APIView):
    """Retrieve re-registration details and items for an application."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, application_id: uuid.UUID) -> Response:
        re_reg = ReRegistrationService.get_for_application(
            user=request.user,
            application_id=application_id,
        )
        return Response(ReRegistrationSerializer(re_reg).data)


class ReRegistrationItemUpdateView(APIView):
    """Update status and notes of a specific re-registration item."""

    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, item_id: uuid.UUID) -> Response:
        serializer = ReRegistrationItemUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        item = ReRegistrationService.update_item(
            user=request.user,
            item_id=item_id,
            item_status=serializer.validated_data["status"],
            notes=serializer.validated_data.get("notes"),
        )
        return Response(ReRegistrationItemSerializer(item).data)


class ReRegistrationCompleteView(APIView):
    """Complete re-registration process."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, re_registration_id: uuid.UUID) -> Response:
        re_reg = ReRegistrationService.complete_re_registration(
            user=request.user,
            re_registration_id=re_registration_id,
        )
        return Response(ReRegistrationSerializer(re_reg).data)
