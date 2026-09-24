"""Pydantic schemas for Admission Period endpoints."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.common import BaseSchema, PaginationMeta


class AvailabilityStatus(StrEnum):
    """Lifecycle availability status for an admission period."""

    OPEN = "OPEN"
    BEFORE_OPENING = "BEFORE_OPENING"
    CLOSED = "CLOSED"
    PERIOD_INACTIVE = "PERIOD_INACTIVE"
    ACADEMIC_YEAR_INACTIVE = "ACADEMIC_YEAR_INACTIVE"


class AdmissionPeriodCreate(BaseSchema):
    """Payload to create a new admission period."""

    academic_year_id: UUID
    name: str = Field(..., min_length=1, max_length=150, examples=["Gelombang 1"])
    code: str = Field(..., min_length=1, max_length=100, examples=["GEL-1-2026"])
    registration_start: datetime
    registration_end: datetime
    announcement_at: datetime | None = None
    quota: int | None = Field(default=None, ge=0)
    is_active: bool = Field(default=True)
    settings: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate_dates(self) -> "AdmissionPeriodCreate":
        if self.registration_start >= self.registration_end:
            raise ValueError("registration_start must be before registration_end")
        if self.announcement_at is not None and self.announcement_at < self.registration_end:
            raise ValueError("announcement_at cannot be earlier than registration_end")
        return self


class AdmissionPeriodUpdate(BaseSchema):
    """Payload to update an existing admission period."""

    name: str | None = Field(default=None, min_length=1, max_length=150)
    code: str | None = Field(default=None, min_length=1, max_length=100)
    registration_start: datetime | None = None
    registration_end: datetime | None = None
    announcement_at: datetime | None = None
    quota: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    settings: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate_dates(self) -> "AdmissionPeriodUpdate":
        if self.registration_start is not None and self.registration_end is not None:
            if self.registration_start >= self.registration_end:
                raise ValueError("registration_start must be before registration_end")
        if (
            self.announcement_at is not None
            and self.registration_end is not None
            and self.announcement_at < self.registration_end
        ):
            raise ValueError("announcement_at cannot be earlier than registration_end")
        return self


class AdmissionPeriodResponse(BaseSchema):
    """Admission period details returned by the API."""

    id: UUID
    academic_year_id: UUID
    name: str
    code: str
    registration_start: datetime
    registration_end: datetime
    announcement_at: datetime | None
    quota: int | None
    is_active: bool
    settings: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class AdmissionPeriodListResponse(BaseSchema):
    """Paginated list of admission periods."""

    items: list[AdmissionPeriodResponse]
    meta: PaginationMeta


class AdmissionPeriodAvailabilityResponse(BaseSchema):
    """Real-time registration availability and draft rules for a period."""

    period_id: UUID
    status: AvailabilityStatus
    is_open: bool
    can_create_draft: bool
    can_submit: bool
    registration_start: datetime
    registration_end: datetime
    server_time: datetime
    quota: int | None
    reason: str | None = None
