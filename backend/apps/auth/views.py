"""Authentication endpoints: register, login, logout, me."""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth.models import User
from apps.auth.serializers import (
    LoginRequestSerializer,
    RegisterRequestSerializer,
    UserProfileSerializer,
)
from apps.auth.services import AuthService


class RegisterView(APIView):
    """Parent account registration."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = AuthService.register(serializer.validated_data)
        return Response(
            UserProfileSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    """User login via email or phone."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = AuthService.authenticate(
            request,
            identifier=serializer.validated_data["identifier"],
            password=serializer.validated_data["password"],
        )
        return Response(UserProfileSerializer(user).data)


class LogoutView(APIView):
    """User logout."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        AuthService.logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """Current authenticated user profile and permissions."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        user = request.user
        assert isinstance(user, User)
        return Response(UserProfileSerializer(user).data)
