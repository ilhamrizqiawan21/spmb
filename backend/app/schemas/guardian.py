"""Pydantic schemas for Guardian endpoints."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.common import BaseSchema


class GuardianRelationship(StrEnum):
    """Permitted relationships between a guardian and applicant."""

    FATHER = "FATHER"
    MOTHER = "MOTHER"
    GUARDIAN = "GUARDIAN"


class GuardianCreate(BaseSchema):
    """Payload to create a new guardian record."""

    relationship: GuardianRelationship
    full_name: str = Field(..., min_length=1, max_length=200, examples=["Ahmad Dahlan"])
    nik: str | None = Field(default=None, max_length=30, examples=["3201012345670001"])
    phone: str | None = Field(default=None, max_length=30, examples=["081234567890"])
    email: EmailStr | None = Field(default=None, examples=["ahmad@example.com"])
    occupation: str | None = Field(default=None, max_length=150, examples=["PNS / Guru"])
    education: str | None = Field(default=None, max_length=100, examples=["S1"])
    monthly_income: Decimal | None = Field(default=None, ge=0, examples=[5000000])
    address: str | None = Field(default=None, examples=["Jl. Pesantren No. 12"])
    is_primary_contact: bool = Field(default=False)


class GuardianUpdate(BaseSchema):
    """Payload to update an existing guardian record."""

    relationship: GuardianRelationship | None = None
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    nik: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    occupation: str | None = Field(default=None, max_length=150)
    education: str | None = Field(default=None, max_length=100)
    monthly_income: Decimal | None = Field(default=None, ge=0)
    address: str | None = None
    is_primary_contact: bool | None = None


class GuardianResponse(BaseSchema):
    """Guardian details returned by the API."""

    id: UUID
    applicant_id: UUID
    relationship: str
    full_name: str
    nik: str | None
    phone: str | None
    email: str | None
    occupation: str | None
    education: str | None
    monthly_income: Decimal | None
    address: str | None
    is_primary_contact: bool
    created_at: datetime
    updated_at: datetime
