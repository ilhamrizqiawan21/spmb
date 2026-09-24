"""Pydantic schemas for Academic Year endpoints."""

from datetime import date, datetime
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.common import BaseSchema, PaginationMeta


class AcademicYearCreate(BaseSchema):
    """Payload to create a new academic year."""

    name: str = Field(..., min_length=1, max_length=50, examples=["2026/2027"])
    start_date: date = Field(..., examples=["2026-07-01"])
    end_date: date = Field(..., examples=["2027-06-30"])
    is_active: bool = Field(default=False)

    @model_validator(mode="after")
    def _validate_dates(self) -> "AcademicYearCreate":
        if self.start_date >= self.end_date:
            raise ValueError("start_date must be before end_date")
        return self


class AcademicYearUpdate(BaseSchema):
    """Payload to update an existing academic year."""

    name: str | None = Field(default=None, min_length=1, max_length=50)
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _validate_dates(self) -> "AcademicYearUpdate":
        if self.start_date is not None and self.end_date is not None:
            if self.start_date >= self.end_date:
                raise ValueError("start_date must be before end_date")
        return self


class AcademicYearResponse(BaseSchema):
    """Academic year details returned by the API."""

    id: UUID
    name: str
    start_date: date
    end_date: date
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AcademicYearListResponse(BaseSchema):
    """Paginated list of academic years."""

    items: list[AcademicYearResponse]
    meta: PaginationMeta
