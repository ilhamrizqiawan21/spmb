"""Pydantic schemas for Applicant endpoints."""

from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema, PaginationMeta
from app.schemas.guardian import GuardianResponse


class ApplicantCreate(BaseSchema):
    """Payload to create a new applicant profile."""

    nisn: str | None = Field(default=None, max_length=20, examples=["0012345678"])
    full_name: str = Field(..., min_length=1, max_length=200, examples=["Muhammad Ilham"])
    nickname: str | None = Field(default=None, max_length=100, examples=["Ilham"])
    gender: str = Field(..., min_length=1, max_length=20, examples=["MALE"])
    birth_place: str = Field(..., min_length=1, max_length=150, examples=["Bandung"])
    birth_date: date = Field(..., examples=["2014-05-15"])
    religion: str | None = Field(default="Islam", max_length=50)
    nationality: str = Field(default="Indonesia", max_length=50)
    nik: str | None = Field(default=None, max_length=30, examples=["3204011505140002"])
    family_card_number: str | None = Field(
        default=None, max_length=30, examples=["3204010101100005"]
    )

    address: str = Field(..., min_length=1, examples=["Jl. Cendrawasih No. 45"])
    province: str | None = Field(default=None, max_length=100, examples=["Jawa Barat"])
    city: str | None = Field(default=None, max_length=100, examples=["Bandung"])
    district: str | None = Field(default=None, max_length=100, examples=["Coblong"])
    village: str | None = Field(default=None, max_length=100, examples=["Dago"])
    postal_code: str | None = Field(default=None, max_length=10, examples=["40135"])

    previous_school_name: str | None = Field(
        default=None, max_length=200, examples=["SD Negeri 1 Dago"]
    )
    previous_school_npsn: str | None = Field(default=None, max_length=30, examples=["20219876"])
    previous_school_address: str | None = Field(
        default=None, examples=["Jl. Ir. H. Juanda No. 100"]
    )



class ApplicantUpdate(BaseSchema):
    """Payload to update an existing applicant profile."""

    nisn: str | None = Field(default=None, max_length=20)
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    nickname: str | None = Field(default=None, max_length=100)
    gender: str | None = Field(default=None, min_length=1, max_length=20)
    birth_place: str | None = Field(default=None, min_length=1, max_length=150)
    birth_date: date | None = None
    religion: str | None = Field(default=None, max_length=50)
    nationality: str | None = Field(default=None, max_length=50)
    nik: str | None = Field(default=None, max_length=30)
    family_card_number: str | None = Field(default=None, max_length=30)

    address: str | None = Field(default=None, min_length=1)
    province: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    village: str | None = Field(default=None, max_length=100)
    postal_code: str | None = Field(default=None, max_length=10)

    previous_school_name: str | None = Field(default=None, max_length=200)
    previous_school_npsn: str | None = Field(default=None, max_length=30)
    previous_school_address: str | None = None


class ApplicantResponse(BaseSchema):
    """Applicant details returned by the API."""

    id: UUID
    owner_user_id: UUID
    nisn: str | None
    full_name: str
    nickname: str | None
    gender: str
    birth_place: str
    birth_date: date
    religion: str | None
    nationality: str
    nik: str | None
    family_card_number: str | None

    address: str
    province: str | None
    city: str | None
    district: str | None
    village: str | None
    postal_code: str | None

    previous_school_name: str | None
    previous_school_npsn: str | None
    previous_school_address: str | None

    guardians: list[GuardianResponse] = []
    created_at: datetime
    updated_at: datetime


class ApplicantListResponse(BaseSchema):
    """Paginated list of applicants."""

    items: list[ApplicantResponse]
    meta: PaginationMeta
