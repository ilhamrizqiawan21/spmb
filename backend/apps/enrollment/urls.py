"""URL configuration for enrollment and re-registration domain endpoints."""

from django.urls import path

from apps.enrollment.views import (
    ReRegistrationCompleteView,
    ReRegistrationDetailView,
    ReRegistrationItemUpdateView,
    ReRegistrationRequirementDetailView,
    ReRegistrationRequirementListCreateView,
    ReRegistrationStartView,
)

app_name = "enrollment"

urlpatterns = [
    path(
        "requirements",
        ReRegistrationRequirementListCreateView.as_view(),
        name="re_registration_requirement_list_create",
    ),
    path(
        "requirements/<uuid:pk>",
        ReRegistrationRequirementDetailView.as_view(),
        name="re_registration_requirement_detail",
    ),
    path(
        "applications/<uuid:application_id>/start-re-registration",
        ReRegistrationStartView.as_view(),
        name="start_re_registration",
    ),
    path(
        "applications/<uuid:application_id>/re-registration",
        ReRegistrationDetailView.as_view(),
        name="re_registration_detail",
    ),
    path(
        "re-registration-items/<uuid:item_id>",
        ReRegistrationItemUpdateView.as_view(),
        name="re_registration_item_update",
    ),
    path(
        "re-registrations/<uuid:re_registration_id>/complete",
        ReRegistrationCompleteView.as_view(),
        name="complete_re_registration",
    ),
]
