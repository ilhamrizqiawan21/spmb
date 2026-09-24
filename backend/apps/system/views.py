"""Health and readiness endpoints."""

from django.conf import settings
from django.db import connections
from django.db.utils import OperationalError
from django_redis import get_redis_connection
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Verifies the application process itself is running."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        return Response(
            {
                "status": "ok",
                "app": settings.APP_NAME,
                "version": "0.1.0",
                "environment": settings.ENVIRONMENT_NAME,
            }
        )


class ReadyView(APIView):
    """Verifies required infrastructure (PostgreSQL, Redis) is reachable."""

    permission_classes = [AllowAny]

    def get(self, request: Request) -> Response:
        database_ok = self._check_database()
        redis_ok = self._check_redis()

        if not (database_ok and redis_ok):
            return Response(
                {"status": "not_ready"},
                status=503,
            )

        return Response(
            {
                "status": "ready",
                "database": "ok",
                "redis": "ok",
            }
        )

    @staticmethod
    def _check_database() -> bool:
        try:
            connections["default"].cursor()
            return True
        except OperationalError:
            return False

    @staticmethod
    def _check_redis() -> bool:
        try:
            return bool(get_redis_connection("default").ping())
        except Exception:
            return False
