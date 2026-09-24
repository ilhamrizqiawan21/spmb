"""URL configuration for authentication endpoints."""

from django.urls import path

from apps.auth.views import LoginView, LogoutView, MeView, RegisterView

app_name = "spmb_auth"

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("login", LoginView.as_view(), name="login"),
    path("logout", LogoutView.as_view(), name="logout"),
    path("me", MeView.as_view(), name="me"),
]
