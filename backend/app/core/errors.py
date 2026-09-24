from typing import Any


class AppException(Exception):
    """Base exception for all application errors."""

    def __init__(
        self,
        message: str = "An error occurred",
        code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details


class DomainException(AppException):
    """Business rule violation exception."""

    def __init__(
        self,
        message: str,
        code: str = "DOMAIN_ERROR",
        details: Any = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=400,
            details=details,
        )


class AuthenticationException(AppException):
    """Authentication failure exception."""

    def __init__(
        self,
        message: str = "Authentication failed",
        code: str = "AUTH_FAILED",
        details: Any = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=401,
            details=details,
        )


class PermissionDeniedException(AppException):
    """Authorization failure / forbidden exception."""

    def __init__(
        self,
        message: str = "You do not have permission to perform this action",
        code: str = "PERMISSION_DENIED",
        details: Any = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=403,
            details=details,
        )


class NotFoundException(AppException):
    """Resource not found exception."""

    def __init__(
        self,
        message: str = "Resource not found",
        code: str = "NOT_FOUND",
        details: Any = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=404,
            details=details,
        )


class ConflictException(AppException):
    """Resource conflict exception (e.g. duplicate key, state conflict)."""

    def __init__(
        self,
        message: str = "Resource conflict occurred",
        code: str = "CONFLICT",
        details: Any = None,
    ) -> None:
        super().__init__(
            message=message,
            code=code,
            status_code=409,
            details=details,
        )
