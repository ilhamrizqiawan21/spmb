"""Authentication and RBAC models for SPMB Terpadu."""

from __future__ import annotations

from collections.abc import Collection
from typing import Any

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models

from apps.common.models import BaseModel, UUIDPrimaryKeyModel


class UserManager(BaseUserManager["User"]):
    """Custom manager for User model supporting email or phone identifiers."""

    def create_user(
        self,
        name: str,
        password: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        **extra_fields: Any,
    ) -> User:
        if not email and not phone:
            raise ValueError("Either email or phone number must be provided.")

        email_clean = self.normalize_email(email) if email else None
        phone_clean = phone.strip() if phone else None

        user = self.model(
            name=name.strip(),
            email=email_clean,
            phone=phone_clean,
            **extra_fields,
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(
        self,
        name: str,
        password: str,
        email: str | None = None,
        phone: str | None = None,
        **extra_fields: Any,
    ) -> User:
        extra_fields.setdefault("is_active", True)
        user = self.create_user(
            name=name,
            password=password,
            email=email,
            phone=phone,
            **extra_fields,
        )
        # Assign super_admin role if it exists
        super_admin_role = Role.objects.filter(code="super_admin").first()
        if super_admin_role:
            UserRole.objects.get_or_create(user=user, role=super_admin_role)
        return user

    def get_by_identifier(self, identifier: str) -> User | None:
        """Find user by email or phone."""
        clean_ident = identifier.strip()
        user = self.filter(email__iexact=clean_ident).first()
        if not user:
            user = self.filter(phone=clean_ident).first()
        return user


class User(AbstractBaseUser, BaseModel):
    """User account shared by parents, staff, and administrators."""

    name = models.CharField(max_length=150)
    email = models.CharField(max_length=255, unique=True, null=True, blank=True)
    phone = models.CharField(max_length=30, unique=True, null=True, blank=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    roles: models.ManyToManyField[Role, UserRole] = models.ManyToManyField(
        "Role",
        through="UserRole",
        related_name="users",
        blank=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    class Meta:
        db_table = "users"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(email__isnull=False) | models.Q(phone__isnull=False),
                name="email_or_phone_required",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.email or self.phone})"

    def get_all_permission_codes(self) -> set[str]:
        """Return the set of all permission codes granted to this user."""
        if not hasattr(self, "_cached_permission_codes"):
            codes = set(
                Permission.objects.filter(
                    permission_roles__role__role_users__user=self
                ).values_list("code", flat=True)
            )
            self._cached_permission_codes = codes
        return self._cached_permission_codes

    def has_perm_code(self, code: str) -> bool:
        """Check if user holds a specific permission code."""
        return code in self.get_all_permission_codes()

    def has_any_perm_codes(self, codes: Collection[str]) -> bool:
        """Check if user holds any of the given permission codes."""
        granted = self.get_all_permission_codes()
        return any(c in granted for c in codes)


class Role(BaseModel):
    """A named role collection of permissions assignable to users."""

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)
    is_system = models.BooleanField(default=False)

    permissions: models.ManyToManyField[Permission, RolePermission] = models.ManyToManyField(
        "Permission",
        through="RolePermission",
        related_name="roles",
        blank=True,
    )

    class Meta:
        db_table = "roles"

    def __str__(self) -> str:
        return self.name


class Permission(BaseModel):
    """A granular permission capability in the system."""

    code = models.CharField(max_length=150, unique=True)
    name = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "permissions"

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class UserRole(UUIDPrimaryKeyModel):
    """Assignment of a role to a user."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_users")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_roles"
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="unique_user_role"),
        ]

    def __str__(self) -> str:
        return f"{self.user} -> {self.role}"


class RolePermission(UUIDPrimaryKeyModel):
    """Assignment of a permission to a role."""

    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="permission_roles"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "role_permissions"
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="unique_role_permission"),
        ]

    def __str__(self) -> str:
        return f"{self.role} -> {self.permission}"
