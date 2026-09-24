"""Request/response contracts for authentication endpoints."""

from uuid import UUID

from pydantic import EmailStr, Field, model_validator

from app.schemas.common import BaseSchema


class RegisterRequest(BaseSchema):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=6, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _require_email_or_phone(self) -> "RegisterRequest":
        if not self.email and not self.phone:
            raise ValueError("Either email or phone must be provided.")
        return self


class LoginRequest(BaseSchema):
    identifier: str = Field(min_length=1, description="Registered email or phone number.")
    password: str = Field(min_length=1)


class UserProfile(BaseSchema):
    id: UUID
    name: str
    email: str | None
    phone: str | None
    is_active: bool
    roles: list[str]
    permissions: list[str]
