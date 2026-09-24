"""URL configuration for selection and assessment domain endpoints."""

from django.urls import path

from apps.selection.views import (
    AnnouncementDetailView,
    AnnouncementLetterDownloadView,
    AnnouncementPublicLookupView,
    AnnouncementPublishView,
    ApplicationDecisionView,
    ApplicationScoreDetailView,
    AssessmentInputView,
    AssessmentScheduleListCreateView,
    PeriodRankingView,
    SelectionComponentDetailView,
    SelectionComponentListCreateView,
    WaitingListPromotionView,
    WaitingListView,
)

app_name = "selection"

urlpatterns = [
    path(
        "components",
        SelectionComponentListCreateView.as_view(),
        name="selection_component_list_create",
    ),
    path(
        "components/<uuid:pk>",
        SelectionComponentDetailView.as_view(),
        name="selection_component_detail",
    ),
    path(
        "schedules",
        AssessmentScheduleListCreateView.as_view(),
        name="assessment_schedule_list_create",
    ),
    path("assessments/input", AssessmentInputView.as_view(), name="assessment_input"),
    path(
        "applications/<uuid:application_id>/scores",
        ApplicationScoreDetailView.as_view(),
        name="application_score_detail",
    ),
    path(
        "periods/<uuid:period_id>/ranking",
        PeriodRankingView.as_view(),
        name="period_ranking",
    ),
    path(
        "applications/<uuid:application_id>/decision",
        ApplicationDecisionView.as_view(),
        name="application_decision",
    ),
    path(
        "periods/<uuid:period_id>/waiting-list",
        WaitingListView.as_view(),
        name="period_waiting_list",
    ),
    path(
        "waiting-list/<uuid:entry_id>/promote",
        WaitingListPromotionView.as_view(),
        name="waiting_list_promote",
    ),
    path(
        "periods/<uuid:period_id>/publish-announcement",
        AnnouncementPublishView.as_view(),
        name="publish_period_announcement",
    ),
    path(
        "applications/<uuid:application_id>/announcement",
        AnnouncementDetailView.as_view(),
        name="application_announcement",
    ),
    path(
        "applications/<uuid:application_id>/announcement/letter",
        AnnouncementLetterDownloadView.as_view(),
        name="application_announcement_letter",
    ),
    path(
        "announcements/lookup",
        AnnouncementPublicLookupView.as_view(),
        name="announcement_public_lookup",
    ),
]

