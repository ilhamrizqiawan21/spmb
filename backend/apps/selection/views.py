"""API views for Selection & Assessment domain (F9)."""

from __future__ import annotations

import uuid
from typing import Any

from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admission.services import ApplicationService
from apps.auth.permissions import HasAnyPermissions, HasPermission
from apps.selection.models import (
    ApplicationDecision,
    ApplicationScore,
    AssessmentSchedule,
    SelectionComponent,
)
from apps.selection.serializers import (
    AnnouncementPublicLookupSerializer,
    AnnouncementPublishSerializer,
    AnnouncementResultSerializer,
    ApplicationDecisionSerializer,
    ApplicationScoreSerializer,
    AssessmentInputSerializer,
    AssessmentScheduleCreateSerializer,
    AssessmentScheduleSerializer,
    AssessmentSerializer,
    DecisionInputSerializer,
    SelectionComponentCreateSerializer,
    SelectionComponentSerializer,
    SelectionComponentUpdateSerializer,
    WaitingListEntrySerializer,
    WaitingListPromotionSerializer,
)
from apps.selection.services import (
    AnnouncementService,
    AssessmentScheduleService,
    AssessmentService,
    DecisionService,
    RankingService,
    SelectionComponentService,
    WaitingListService,
)


class SelectionComponentListCreateView(APIView):
    """List selection components or create a new component."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def get(self, request: Request) -> Response:
        period_id_str = request.query_params.get("admission_period_id")
        period_id = None
        if period_id_str:
            try:
                period_id = uuid.UUID(period_id_str)
            except ValueError as exc:
                raise NotFound({"admission_period_id": "Invalid period ID format."}) from exc

        components = SelectionComponentService.list_for_period(period_id)
        return Response(SelectionComponentSerializer(components, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = SelectionComponentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        component = SelectionComponentService.create(serializer.validated_data)
        return Response(
            SelectionComponentSerializer(component).data,
            status=status.HTTP_201_CREATED,
        )


class SelectionComponentDetailView(APIView):
    """Retrieve, update, or delete a selection component."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def _get_object(self, pk: uuid.UUID) -> SelectionComponent:
        try:
            return SelectionComponent.objects.get(pk=pk)
        except SelectionComponent.DoesNotExist as exc:
            raise NotFound({"detail": "Selection component not found."}) from exc

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        comp = self._get_object(pk)
        return Response(SelectionComponentSerializer(comp).data)

    def patch(self, request: Request, pk: uuid.UUID) -> Response:
        comp = self._get_object(pk)
        serializer = SelectionComponentUpdateSerializer(comp, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = SelectionComponentService.update(comp, serializer.validated_data)
        return Response(SelectionComponentSerializer(updated).data)

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        comp = self._get_object(pk)
        SelectionComponentService.delete(comp)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssessmentScheduleListCreateView(APIView):
    """List assessment schedules or schedule a candidate."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["assessment.input", "assessment.approve", "application.override"])(),
        ]

    def get(self, request: Request) -> Response:
        app_id_str = request.query_params.get("application_id")
        queryset = AssessmentSchedule.objects.select_related("application", "component").all()
        if app_id_str:
            try:
                queryset = queryset.filter(application_id=uuid.UUID(app_id_str))
            except ValueError as exc:
                raise NotFound({"application_id": "Invalid application ID format."}) from exc

        return Response(AssessmentScheduleSerializer(queryset, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AssessmentScheduleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        schedule = AssessmentScheduleService.create_schedule(
            user=request.user,
            application_id=serializer.validated_data["application_id"],
            component_id=serializer.validated_data["component_id"],
            scheduled_at=serializer.validated_data["scheduled_at"],
            location=serializer.validated_data.get("location"),
            room=serializer.validated_data.get("room"),
            notes=serializer.validated_data.get("notes"),
        )
        return Response(
            AssessmentScheduleSerializer(schedule).data,
            status=status.HTTP_201_CREATED,
        )


class AssessmentInputView(APIView):
    """Assessor endpoint for inputting/updating scores."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["assessment.input", "assessment.approve", "application.override"])(),
        ]

    def post(self, request: Request) -> Response:
        serializer = AssessmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        assessment = AssessmentService.input_score(
            user=request.user,
            application_id=serializer.validated_data["application_id"],
            component_id=serializer.validated_data["component_id"],
            score=serializer.validated_data["score"],
            notes=serializer.validated_data.get("notes"),
        )
        return Response(
            AssessmentSerializer(assessment).data,
            status=status.HTTP_200_OK,
        )


class ApplicationScoreDetailView(APIView):
    """Retrieve score summary and breakdown for an application."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, application_id: uuid.UUID) -> Response:
        app = ApplicationService.get_for_user(request.user, application_id)
        try:
            score_summary = ApplicationScore.objects.select_related("application").get(
                application=app
            )
        except ApplicationScore.DoesNotExist as exc:
            raise NotFound({"detail": "Score summary not found for this application."}) from exc

        return Response(ApplicationScoreSerializer(score_summary).data)


class PeriodRankingView(APIView):
    """View or execute candidate ranking for an admission period."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["assessment.approve", "application.override"])(),
        ]

    def get(self, request: Request, period_id: uuid.UUID) -> Response:
        scores = (
            ApplicationScore.objects.filter(application__admission_period_id=period_id)
            .select_related("application__applicant")
            .order_by("rank")
        )
        return Response(ApplicationScoreSerializer(scores, many=True).data)

    def post(self, request: Request, period_id: uuid.UUID) -> Response:
        ranked_scores = RankingService.rank_period_applications(period_id)
        return Response(ApplicationScoreSerializer(ranked_scores, many=True).data)


class ApplicationDecisionView(APIView):
    """Retrieve or make/override admission decision for an application."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [
            IsAuthenticated(),
            HasAnyPermissions(["assessment.approve", "application.override"])(),
        ]

    def get(self, request: Request, application_id: uuid.UUID) -> Response:
        app = ApplicationService.get_for_user(request.user, application_id)
        try:
            decision = (
                ApplicationDecision.objects.select_related("application", "decided_by")
                .prefetch_related("histories__changed_by")
                .get(application=app)
            )
        except ApplicationDecision.DoesNotExist as exc:
            raise NotFound(
                {"detail": "Admission decision not found for this application."}
            ) from exc

        return Response(ApplicationDecisionSerializer(decision).data)

    def post(self, request: Request, application_id: uuid.UUID) -> Response:
        serializer = DecisionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        app_decision = DecisionService.make_decision(
            user=request.user,
            application_id=application_id,
            decision=serializer.validated_data["decision"],
            reason=serializer.validated_data.get("reason"),
        )
        return Response(
            ApplicationDecisionSerializer(app_decision).data,
            status=status.HTTP_200_OK,
        )


class WaitingListView(APIView):
    """List waitlisted applicants for an admission period."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["assessment.approve", "application.override"])(),
        ]

    def get(self, request: Request, period_id: uuid.UUID) -> Response:
        entries = WaitingListService.list_for_period(period_id)
        return Response(WaitingListEntrySerializer(entries, many=True).data)


class WaitingListPromotionView(APIView):
    """Promote a candidate from waiting list to ACCEPTED."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["assessment.approve", "application.override"])(),
        ]

    def post(self, request: Request, entry_id: uuid.UUID) -> Response:
        serializer = WaitingListPromotionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = WaitingListService.promote_candidate(
            user=request.user,
            entry_id=entry_id,
            reason=serializer.validated_data["reason"],
        )
        return Response(
            WaitingListEntrySerializer(entry).data,
            status=status.HTTP_200_OK,
        )


class AnnouncementPublishView(APIView):
    """Admin endpoint to bulk publish announcements for an admission period."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["announcement.publish", "application.override"])(),
        ]

    def post(self, request: Request, period_id: uuid.UUID) -> Response:
        serializer = AnnouncementPublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pub_at = serializer.validated_data.get("published_at")
        updated_count = AnnouncementService.publish_period_announcements(
            user=request.user,
            period_id=period_id,
            published_at=pub_at,
        )
        return Response(
            {"published_count": updated_count, "detail": "Announcements published successfully."},
            status=status.HTTP_200_OK,
        )


class AnnouncementDetailView(APIView):
    """Parent/Admin endpoint to view decision announcement and next steps."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, application_id: uuid.UUID) -> Response:
        result_data = AnnouncementService.get_announcement_result(
            user=request.user,
            application_id=application_id,
        )
        serializer = AnnouncementResultSerializer(result_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AnnouncementPublicLookupView(APIView):
    """Public endpoint for result lookup using registration number and birth date."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = AnnouncementPublicLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        result_data = AnnouncementService.public_lookup(
            registration_number=serializer.validated_data["registration_number"],
            birth_date=serializer.validated_data["birth_date"],
        )
        return Response(result_data, status=status.HTTP_200_OK)


class AnnouncementLetterDownloadView(APIView):
    """Download official selection decision letter (PDF format)."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, application_id: uuid.UUID) -> Response | HttpResponse:
        filename, pdf_bytes = AnnouncementService.generate_result_letter(
            user=request.user,
            application_id=application_id,
        )
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

