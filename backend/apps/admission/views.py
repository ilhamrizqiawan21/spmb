"""API views for Academic Years and Admission Periods."""

from __future__ import annotations

import uuid
from typing import Any

from django.http import FileResponse
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admission.models import (
    AcademicYear,
    AdmissionPeriod,
    ApplicationDocument,
    DocumentRequirement,
)
from apps.admission.serializers import (
    AcademicYearCreateSerializer,
    AcademicYearSerializer,
    AcademicYearUpdateSerializer,
    AdmissionPeriodAvailabilitySerializer,
    AdmissionPeriodCreateSerializer,
    AdmissionPeriodSerializer,
    AdmissionPeriodUpdateSerializer,
    ApplicantCreateSerializer,
    ApplicantSerializer,
    ApplicantUpdateSerializer,
    ApplicationCreateDraftSerializer,
    ApplicationDocumentSerializer,
    ApplicationSerializer,
    ApplicationTransitionSerializer,
    DocumentRequirementCreateSerializer,
    DocumentRequirementSerializer,
    DocumentRequirementUpdateSerializer,
    DocumentRevisionRequestSerializer,
    DocumentVerifySerializer,
    GuardianCreateSerializer,
    GuardianSerializer,
    GuardianUpdateSerializer,
)
from apps.admission.services import (
    AcademicYearService,
    AdmissionPeriodService,
    ApplicantService,
    ApplicationService,
    ApplicationStateMachineService,
    DocumentRequirementService,
    DocumentService,
    GuardianService,
    RegistrationAvailabilityService,
)
from apps.auth.permissions import HasAnyPermissions, HasPermission
from apps.common.storage import get_storage


class AcademicYearListCreateView(APIView):
    """List or create academic years."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def get(self, request: Request) -> Response:
        years = AcademicYear.objects.all()
        return Response(AcademicYearSerializer(years, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AcademicYearCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        academic_year = AcademicYearService.create(serializer.validated_data)
        return Response(
            AcademicYearSerializer(academic_year).data,
            status=status.HTTP_201_CREATED,
        )


class AcademicYearDetailView(APIView):
    """Retrieve, update, or delete an academic year."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def _get_object(self, pk: uuid.UUID) -> AcademicYear:
        try:
            return AcademicYear.objects.get(pk=pk)
        except AcademicYear.DoesNotExist as exc:
            raise NotFound({"detail": "Academic year not found."}) from exc

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        year = self._get_object(pk)
        return Response(AcademicYearSerializer(year).data)

    def patch(self, request: Request, pk: uuid.UUID) -> Response:
        year = self._get_object(pk)
        serializer = AcademicYearUpdateSerializer(year, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = AcademicYearService.update(year, serializer.validated_data)
        return Response(AcademicYearSerializer(updated).data)

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        year = self._get_object(pk)
        AcademicYearService.delete(year)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdmissionPeriodListCreateView(APIView):
    """List or create admission periods."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def get(self, request: Request) -> Response:
        queryset = AdmissionPeriod.objects.select_related("academic_year").all()

        ay_id = request.query_params.get("academic_year_id")
        if ay_id:
            try:
                queryset = queryset.filter(academic_year_id=uuid.UUID(ay_id))
            except ValueError as exc:
                raise NotFound({"academic_year_id": "Invalid academic year ID format."}) from exc

        is_active_param = request.query_params.get("is_active")
        if is_active_param is not None:
            is_active = is_active_param.lower() in ["true", "1"]
            queryset = queryset.filter(is_active=is_active)

        return Response(AdmissionPeriodSerializer(queryset, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = AdmissionPeriodCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        period = AdmissionPeriodService.create(serializer.validated_data)
        return Response(
            AdmissionPeriodSerializer(period).data,
            status=status.HTTP_201_CREATED,
        )


class AdmissionPeriodDetailView(APIView):
    """Retrieve, update, or delete an admission period."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def _get_object(self, pk: uuid.UUID) -> AdmissionPeriod:
        try:
            return AdmissionPeriod.objects.select_related("academic_year").get(pk=pk)
        except AdmissionPeriod.DoesNotExist as exc:
            raise NotFound({"detail": "Admission period not found."}) from exc

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        period = self._get_object(pk)
        return Response(AdmissionPeriodSerializer(period).data)

    def patch(self, request: Request, pk: uuid.UUID) -> Response:
        period = self._get_object(pk)
        serializer = AdmissionPeriodUpdateSerializer(period, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = AdmissionPeriodService.update(period, serializer.validated_data)
        return Response(AdmissionPeriodSerializer(updated).data)

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        period = self._get_object(pk)
        AdmissionPeriodService.delete(period)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdmissionPeriodAvailabilityView(APIView):
    """Check current availability status of an admission period."""

    permission_classes = [AllowAny]

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        availability_data = RegistrationAvailabilityService.get_period_availability(pk)
        return Response(AdmissionPeriodAvailabilitySerializer(availability_data).data)


class ApplicantListCreateView(APIView):
    """List applicants for authenticated user or create a new applicant."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        applicants = ApplicantService.list_for_user(request.user)
        return Response(ApplicantSerializer(applicants, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ApplicantCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        applicant = ApplicantService.create(request.user, serializer.validated_data)
        return Response(
            ApplicantSerializer(applicant).data,
            status=status.HTTP_201_CREATED,
        )


class ApplicantDetailView(APIView):
    """Retrieve, update, or delete an applicant."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        applicant = ApplicantService.get_for_user(request.user, pk)
        return Response(ApplicantSerializer(applicant).data)

    def patch(self, request: Request, pk: uuid.UUID) -> Response:
        applicant = ApplicantService.get_for_user(request.user, pk)
        serializer = ApplicantUpdateSerializer(applicant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = ApplicantService.update(request.user, applicant, serializer.validated_data)
        return Response(ApplicantSerializer(updated).data)

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        applicant = ApplicantService.get_for_user(request.user, pk)
        ApplicantService.delete(request.user, applicant)
        return Response(status=status.HTTP_204_NO_CONTENT)


class GuardianListCreateView(APIView):
    """List or create guardians for a specific applicant."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, applicant_pk: uuid.UUID) -> Response:
        guardians = GuardianService.list_for_applicant(request.user, applicant_pk)
        return Response(GuardianSerializer(guardians, many=True).data)

    def post(self, request: Request, applicant_pk: uuid.UUID) -> Response:
        serializer = GuardianCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        guardian = GuardianService.create(request.user, applicant_pk, serializer.validated_data)
        return Response(
            GuardianSerializer(guardian).data,
            status=status.HTTP_201_CREATED,
        )


class GuardianDetailView(APIView):
    """Retrieve, update, or delete a guardian for a specific applicant."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, applicant_pk: uuid.UUID, pk: uuid.UUID) -> Response:
        guardian = GuardianService.get_for_applicant(request.user, applicant_pk, pk)
        return Response(GuardianSerializer(guardian).data)

    def patch(self, request: Request, applicant_pk: uuid.UUID, pk: uuid.UUID) -> Response:
        guardian = GuardianService.get_for_applicant(request.user, applicant_pk, pk)
        serializer = GuardianUpdateSerializer(guardian, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = GuardianService.update(request.user, guardian, serializer.validated_data)
        return Response(GuardianSerializer(updated).data)

    def delete(self, request: Request, applicant_pk: uuid.UUID, pk: uuid.UUID) -> Response:
        guardian = GuardianService.get_for_applicant(request.user, applicant_pk, pk)
        GuardianService.delete(request.user, guardian)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplicationListCreateView(APIView):
    """List applications or create a draft application."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        applications = ApplicationService.list_for_user(request.user)
        return Response(ApplicationSerializer(applications, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = ApplicationCreateDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = ApplicationService.create_draft(
            user=request.user,
            applicant_id=serializer.validated_data["applicant_id"],
            admission_period_id=serializer.validated_data["admission_period_id"],
        )
        return Response(
            ApplicationSerializer(application).data,
            status=status.HTTP_201_CREATED,
        )


class ApplicationDetailView(APIView):
    """Retrieve application details."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        application = ApplicationService.get_for_user(request.user, pk)
        return Response(ApplicationSerializer(application).data)


class ApplicationSubmitView(APIView):
    """Submit a draft application."""

    permission_classes = [IsAuthenticated]

    def post(self, request: Request, pk: uuid.UUID) -> Response:
        application = ApplicationService.submit(request.user, pk)
        return Response(ApplicationSerializer(application).data)


class ApplicationTransitionView(APIView):
    """Transition application status."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(
                [
                    "application.verify",
                    "document.verify",
                    "application.override",
                    "assessment.input",
                    "assessment.approve",
                ]
            )(),
        ]

    def post(self, request: Request, pk: uuid.UUID) -> Response:
        application = ApplicationService.get_for_user(request.user, pk)
        serializer = ApplicationTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = ApplicationStateMachineService.transition(
            user=request.user,
            application=application,
            to_status=serializer.validated_data["to_status"],
            reason=serializer.validated_data.get("reason"),
            metadata=serializer.validated_data.get("metadata"),
        )
        return Response(ApplicationSerializer(updated).data)


class DocumentRequirementListCreateView(APIView):
    """List document requirements or create a new requirement."""

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

        requirements = DocumentRequirementService.list_requirements(period_id)
        return Response(DocumentRequirementSerializer(requirements, many=True).data)

    def post(self, request: Request) -> Response:
        serializer = DocumentRequirementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requirement = DocumentRequirementService.create(serializer.validated_data)
        return Response(
            DocumentRequirementSerializer(requirement).data,
            status=status.HTTP_201_CREATED,
        )


class DocumentRequirementDetailView(APIView):
    """Retrieve, update, or delete a document requirement."""

    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated(), HasPermission("application.override")()]

    def _get_object(self, pk: uuid.UUID) -> DocumentRequirement:
        try:
            return DocumentRequirement.objects.get(pk=pk)
        except DocumentRequirement.DoesNotExist as exc:
            raise NotFound({"detail": "Document requirement not found."}) from exc

    def get(self, request: Request, pk: uuid.UUID) -> Response:
        requirement = self._get_object(pk)
        return Response(DocumentRequirementSerializer(requirement).data)

    def patch(self, request: Request, pk: uuid.UUID) -> Response:
        requirement = self._get_object(pk)
        serializer = DocumentRequirementUpdateSerializer(
            requirement, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        updated = DocumentRequirementService.update(requirement, serializer.validated_data)
        return Response(DocumentRequirementSerializer(updated).data)

    def delete(self, request: Request, pk: uuid.UUID) -> Response:
        requirement = self._get_object(pk)
        DocumentRequirementService.delete(requirement)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplicationDocumentUploadView(APIView):
    """List or upload documents for an application."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request, application_pk: uuid.UUID) -> Response:
        application = ApplicationService.get_for_user(request.user, application_pk)
        documents = (
            ApplicationDocument.objects.filter(application=application)
            .select_related("requirement", "verified_by")
            .prefetch_related("revisions")
        )
        return Response(ApplicationDocumentSerializer(documents, many=True).data)

    def post(self, request: Request, application_pk: uuid.UUID) -> Response:
        requirement_id_str = request.data.get("requirement_id")
        file_obj = request.FILES.get("file")

        if not requirement_id_str or not file_obj:
            raise ValidationError({"detail": "Both requirement_id and file are required."})

        try:
            requirement_id = uuid.UUID(str(requirement_id_str))
        except ValueError as exc:
            raise ValidationError({"requirement_id": "Invalid requirement ID format."}) from exc

        document = DocumentService.upload_document(
            user=request.user,
            application_id=application_pk,
            requirement_id=requirement_id,
            file_obj=file_obj,
        )
        return Response(
            ApplicationDocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class ApplicationDocumentDownloadView(APIView):
    """Download or stream an uploaded document securely."""

    def get_permissions(self) -> list[Any]:
        if self.request.query_params.get("token"):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request: Request, pk: uuid.UUID) -> Response | FileResponse:
        token = request.query_params.get("token")
        storage = get_storage()

        if token:
            try:
                storage_key = storage.verify_signed_token(token)
            except (PermissionError, FileNotFoundError) as exc:
                raise PermissionDenied({"detail": str(exc)}) from exc

            try:
                document = ApplicationDocument.objects.get(pk=pk)
            except ApplicationDocument.DoesNotExist as exc:
                raise NotFound({"detail": "Document not found."}) from exc

            if document.storage_key != storage_key:
                raise PermissionDenied({"detail": "Token does not match document."})

            file_stream = storage.open(document.storage_key)
            return FileResponse(
                file_stream,
                content_type=document.mime_type,
                filename=document.original_filename,
            )

        document, file_stream = DocumentService.get_document_file(request.user, pk)
        return FileResponse(
            file_stream,
            content_type=document.mime_type,
            filename=document.original_filename,
        )


class ApplicationDocumentVerifyView(APIView):
    """Verify an uploaded application document."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["document.verify", "application.verify", "application.override"])(),
        ]

    def post(self, request: Request, pk: uuid.UUID) -> Response:
        serializer = DocumentVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = DocumentService.verify_document(
            user=request.user,
            document_id=pk,
            is_valid=serializer.validated_data["is_valid_doc"],
            verification_note=serializer.validated_data.get("verification_note"),
        )

        return Response(ApplicationDocumentSerializer(document).data)


class ApplicationDocumentRevisionView(APIView):
    """Request a revision for an uploaded application document."""

    def get_permissions(self) -> list[Any]:
        return [
            IsAuthenticated(),
            HasAnyPermissions(["document.verify", "application.verify", "application.override"])(),
        ]

    def post(self, request: Request, pk: uuid.UUID) -> Response:
        serializer = DocumentRevisionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        document = DocumentService.request_revision(
            user=request.user,
            document_id=pk,
            reason=serializer.validated_data["reason"],
        )
        return Response(ApplicationDocumentSerializer(document).data)
