"""DRF permission classes and factories for RBAC enforcement."""

from __future__ import annotations

from collections.abc import Collection

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView


def HasPermission(code: str) -> type[BasePermission]:
    """Create a DRF permission class that requires a specific permission code."""

    class _PermissionRequirement(BasePermission):
        message = f"Permission '{code}' is required for this action."

        def has_permission(self, request: Request, view: APIView) -> bool:
            if not request.user or not request.user.is_authenticated:
                return False
            has_perm = getattr(request.user, "has_perm_code", None)
            if callable(has_perm):
                return bool(has_perm(code))
            return False

    _PermissionRequirement.__name__ = f"HasPermission_{code.replace('.', '_')}"
    return _PermissionRequirement


def HasAnyPermissions(codes: Collection[str]) -> type[BasePermission]:
    """Create a DRF permission class that requires any of the specified permission codes."""

    class _AnyPermissionRequirement(BasePermission):
        message = f"One of permissions {sorted(codes)} is required for this action."

        def has_permission(self, request: Request, view: APIView) -> bool:
            if not request.user or not request.user.is_authenticated:
                return False
            has_any = getattr(request.user, "has_any_perm_codes", None)
            if callable(has_any):
                return bool(has_any(codes))
            return False

    codes_str = "_".join(c.replace(".", "_") for c in sorted(codes))
    _AnyPermissionRequirement.__name__ = f"HasAnyPermissions_{codes_str}"
    return _AnyPermissionRequirement
