"""Admission period model representing admission waves and tracks."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.academic_year import AcademicYear


class AdmissionPeriod(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An admission wave or track (e.g. Gelombang 1, Jalur Prestasi) under an academic year."""

    __tablename__ = "admission_periods"
    __table_args__ = (
        ForeignKeyConstraint(
            ["academic_year_id"],
            ["academic_years.id"],
            name="fk_admission_periods_academic_year_id_academic_years",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "registration_start < registration_end",
            name="ck_admission_periods_start_before_end",
        ),
        CheckConstraint(
            "quota IS NULL OR quota >= 0",
            name="ck_admission_periods_quota_non_negative",
        ),
        UniqueConstraint(
            "academic_year_id",
            "code",
            name="uq_admission_periods_academic_year_code",
        ),
        Index("ix_admission_periods_academic_year_id", "academic_year_id"),
    )

    academic_year_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str] = mapped_column(String(100), nullable=False)
    registration_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    registration_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    announcement_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=true(), default=True
    )
    settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    academic_year: Mapped["AcademicYear"] = relationship(
        "AcademicYear", back_populates="admission_periods"
    )

