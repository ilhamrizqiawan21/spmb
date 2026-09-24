"""Root URL configuration."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from apps.system.views import HealthView, ReadyView

api_v1_patterns: list = [
    # Domain app routers are included here as they are implemented, e.g.:
    # path("auth/", include("apps.auth.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", HealthView.as_view(), name="health"),
    path("ready", ReadyView.as_view(), name="ready"),
    path(settings.API_V1_PREFIX.lstrip("/") + "/", include(api_v1_patterns)),
]
