"""URL configuration for admission domain endpoints."""

from django.urls import path

from apps.admission.views import (
    AcademicYearDetailView,
    AcademicYearListCreateView,
    AdmissionPeriodAvailabilityView,
    AdmissionPeriodDetailView,
    AdmissionPeriodListCreateView,
    ApplicantDetailView,
    ApplicantListCreateView,
    ApplicationDetailView,
    ApplicationDocumentDownloadView,
    ApplicationDocumentRevisionView,
    ApplicationDocumentUploadView,
    ApplicationDocumentVerifyView,
    ApplicationListCreateView,
    ApplicationSubmitView,
    ApplicationTransitionView,
    DocumentRequirementDetailView,
    DocumentRequirementListCreateView,
    GuardianDetailView,
    GuardianListCreateView,
)

app_name = "admission"

urlpatterns = [
    path("academic-years", AcademicYearListCreateView.as_view(), name="academic_year_list_create"),
    path(
        "academic-years/<uuid:pk>",
        AcademicYearDetailView.as_view(),
        name="academic_year_detail",
    ),
    path("periods", AdmissionPeriodListCreateView.as_view(), name="admission_period_list_create"),
    path("periods/<uuid:pk>", AdmissionPeriodDetailView.as_view(), name="admission_period_detail"),
    path(
        "periods/<uuid:pk>/availability",
        AdmissionPeriodAvailabilityView.as_view(),
        name="admission_period_availability",
    ),
    path("applicants", ApplicantListCreateView.as_view(), name="applicant_list_create"),
    path("applicants/<uuid:pk>", ApplicantDetailView.as_view(), name="applicant_detail"),
    path(
        "applicants/<uuid:applicant_pk>/guardians",
        GuardianListCreateView.as_view(),
        name="guardian_list_create",
    ),
    path(
        "applicants/<uuid:applicant_pk>/guardians/<uuid:pk>",
        GuardianDetailView.as_view(),
        name="guardian_detail",
    ),
    path("applications", ApplicationListCreateView.as_view(), name="application_list_create"),
    path("applications/<uuid:pk>", ApplicationDetailView.as_view(), name="application_detail"),
    path(
        "applications/<uuid:pk>/submit",
        ApplicationSubmitView.as_view(),
        name="application_submit",
    ),
    path(
        "applications/<uuid:pk>/transition",
        ApplicationTransitionView.as_view(),
        name="application_transition",
    ),
    path(
        "document-requirements",
        DocumentRequirementListCreateView.as_view(),
        name="document_requirement_list_create",
    ),
    path(
        "document-requirements/<uuid:pk>",
        DocumentRequirementDetailView.as_view(),
        name="document_requirement_detail",
    ),
    path(
        "applications/<uuid:application_pk>/documents",
        ApplicationDocumentUploadView.as_view(),
        name="application_document_upload",
    ),
    path(
        "documents/<uuid:pk>/download",
        ApplicationDocumentDownloadView.as_view(),
        name="application_document_download",
    ),
    path(
        "documents/<uuid:pk>/verify",
        ApplicationDocumentVerifyView.as_view(),
        name="application_document_verify",
    ),
    path(
        "documents/<uuid:pk>/request-revision",
        ApplicationDocumentRevisionView.as_view(),
        name="application_document_request_revision",
    ),
]
