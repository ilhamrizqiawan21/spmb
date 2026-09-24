"""Project-wide DRF exception handler.

Wraps every API error response in a consistent envelope and ensures
unhandled server errors never leak stack traces, SQL, or internal paths.
"""

import logging
from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

_CODE_BY_STATUS = {
    status.HTTP_400_BAD_REQUEST: "VALIDATION_ERROR",
    status.HTTP_401_UNAUTHORIZED: "AUTHENTICATION_REQUIRED",
    status.HTTP_403_FORBIDDEN: "FORBIDDEN",
    status.HTTP_404_NOT_FOUND: "NOT_FOUND",
    status.HTTP_405_METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
    status.HTTP_409_CONFLICT: "CONFLICT",
    status.HTTP_429_TOO_MANY_REQUESTS: "RATE_LIMIT_EXCEEDED",
}


def exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    """Return a `{"error": {code, message, details}}` envelope for API errors."""
    response = drf_exception_handler(exc, context)

    if response is None:
        logger.exception("Unhandled server error: %s", exc)
        return Response(
            {
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An internal server error occurred",
                    "details": None,
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = _CODE_BY_STATUS.get(response.status_code, "HTTP_ERROR")
    response.data = {
        "error": {
            "code": code,
            "message": str(exc),
            "details": response.data,
        }
    }
    return response
