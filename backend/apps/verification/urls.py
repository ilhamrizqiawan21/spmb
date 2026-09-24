"""URL configuration for verification domain endpoints."""

from django.urls import path

from apps.verification.views import (
    VerificationAssignmentListCreateView,
    VerificationCompleteView,
    VerificationQueueView,
    VerificationReviewListView,
)

app_name = "verification"

urlpatterns = [
    path("queue", VerificationQueueView.as_view(), name="verification_queue"),
    path(
        "assignments",
        VerificationAssignmentListCreateView.as_view(),
        name="verification_assignment_create",
    ),
    path(
        "applications/<uuid:application_id>/reviews",
        VerificationReviewListView.as_view(),
        name="verification_review_list",
    ),
    path(
        "applications/<uuid:application_id>/complete",
        VerificationCompleteView.as_view(),
        name="verification_complete",
    ),
]
