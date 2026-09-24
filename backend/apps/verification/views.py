"""API views for Verification Center (F8)."""

from __future__ import annotations

import uuid
from typing import Any

from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth.permissions import HasAnyPermissions
from apps.verification.models import VerificationReview
from apps.verification.serializers import (
    VerificationAssignmentCreateSerializer,
    VerificationAssignmentSerializer,
    VerificationCompleteSerializer,
    VerificationQueueItemSerializer,
    VerificationReviewSerializer,
)
from apps.verification.services import VerificationAssignmentService, VerificationReviewService


class VerificationQueueView(APIView):
    """List applications in the verifier work queue with filters."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["document.verify", "application.verify", "application.override"])(),
        ]

    def get(self, request: Request) -> Response:
        assignment_filter = request.query_params.get("assignment")
        status_filter = request.query_params.get("status")
        period_id_str = request.query_params.get("admission_period_id")
        search = request.query_params.get("search")

        period_id = None
        if period_id_str:
            try:
                period_id = uuid.UUID(period_id_str)
            except ValueError as exc:
                raise NotFound({"admission_period_id": "Invalid period ID format."}) from exc

        applications = VerificationReviewService.get_verifier_queue(
            user=request.user,
            assignment_filter=assignment_filter,
            status_filter=status_filter,
            period_id=period_id,
            search=search,
        )
        return Response(VerificationQueueItemSerializer(applications, many=True).data)


class VerificationAssignmentListCreateView(APIView):
    """Assign an application to a verifier."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["application.verify", "application.override"])(),
        ]

    def post(self, request: Request) -> Response:
        serializer = VerificationAssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assignment = VerificationAssignmentService.assign(
            assigned_by=request.user,
            application_id=serializer.validated_data["application_id"],
            verifier_id=serializer.validated_data["verifier_id"],
        )
        return Response(
            VerificationAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )


class VerificationReviewListView(APIView):
    """List verification reviews for an application."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["document.verify", "application.verify", "application.override"])(),
        ]

    def get(self, request: Request, application_id: uuid.UUID) -> Response:
        reviews = VerificationReview.objects.filter(application_id=application_id).select_related(
            "verifier"
        )
        return Response(VerificationReviewSerializer(reviews, many=True).data)


class VerificationCompleteView(APIView):
    """Complete verification review for an application."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["document.verify", "application.verify", "application.override"])(),
        ]

    def post(self, request: Request, application_id: uuid.UUID) -> Response:
        serializer = VerificationCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review = VerificationReviewService.complete_verification(
            user=request.user,
            application_id=application_id,
            to_status=serializer.validated_data["to_status"],
            notes=serializer.validated_data.get("notes"),
        )
        return Response(VerificationReviewSerializer(review).data)
