"""Authentication and user profile serializers."""

from __future__ import annotations

from typing import Any

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.auth.models import User


class RegisterRequestSerializer(serializers.Serializer[dict[str, Any]]):
    name = serializers.CharField(max_length=150, required=True)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True, default=None)
    phone = serializers.CharField(
        max_length=30, required=False, allow_null=True, allow_blank=True, default=None
    )
    password = serializers.CharField(write_only=True, required=True, min_length=8)

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        email = attrs.get("email")
        phone = attrs.get("phone")

        if not email and not phone:
            raise serializers.ValidationError(
                {"identifier": "Either email or phone number is required."}
            )

        if email:
            email_clean = email.strip().lower()
            if User.objects.filter(email__iexact=email_clean).exists():
                raise serializers.ValidationError({"email": "Email is already registered."})
            attrs["email"] = email_clean

        if phone:
            phone_clean = phone.strip()
            if User.objects.filter(phone=phone_clean).exists():
                raise serializers.ValidationError({"phone": "Phone number is already registered."})
            attrs["phone"] = phone_clean

        password = attrs.get("password", "")
        try:
            validate_password(password)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        return attrs


class LoginRequestSerializer(serializers.Serializer[dict[str, Any]]):
    identifier = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True)


class UserProfileSerializer(serializers.ModelSerializer[User]):
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "email",
            "phone",
            "is_active",
            "roles",
            "permissions",
        ]
        read_only_fields = fields

    def get_roles(self, obj: User) -> list[str]:
        return list(obj.roles.order_by("code").values_list("code", flat=True))

    def get_permissions(self, obj: User) -> list[str]:
        return sorted(obj.get_all_permission_codes())
