"""Business logic for user registration, authentication, and session lifecycle."""

from __future__ import annotations

from typing import Any

from django.contrib.auth import login, logout
from django.core.cache import cache
from django.http import HttpRequest
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied

from apps.auth.models import Role, User, UserRole

DEFAULT_PARENT_ROLE_CODE = "parent"
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 900  # 15 minutes


class AuthService:
    """Service handling account registration, login verification, and sessions."""

    @staticmethod
    def register(validated_data: dict[str, Any]) -> User:
        password = validated_data.pop("password")
        user = User.objects.create_user(
            password=password,
            **validated_data,
        )

        parent_role = Role.objects.filter(code=DEFAULT_PARENT_ROLE_CODE).first()
        if parent_role:
            UserRole.objects.create(user=user, role=parent_role)

        return user

    @classmethod
    def authenticate(cls, request: HttpRequest, identifier: str, password: str) -> User:
        clean_ident = identifier.strip().lower()
        cache_key = f"login_attempts:{clean_ident}"
        attempts = cache.get(cache_key, 0)

        if attempts >= LOGIN_MAX_ATTEMPTS:
            raise PermissionDenied(
                "Too many failed login attempts. Please try again in 15 minutes."
            )

        user = User.objects.get_by_identifier(clean_ident)
        if user is None or not user.check_password(password):
            cache.set(cache_key, attempts + 1, timeout=LOGIN_WINDOW_SECONDS)
            raise AuthenticationFailed("Invalid credentials.")

        if not user.is_active:
            raise AuthenticationFailed("This account is inactive.")

        # Success - clear rate limit cache and update login timestamp
        cache.delete(cache_key)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login", "updated_at"])

        # Create session and attach user to request
        login(request, user)
        return user

    @staticmethod
    def logout(request: HttpRequest) -> None:
        logout(request)
