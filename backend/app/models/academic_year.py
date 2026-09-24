"""Academic year model for managing admission cycles."""

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, Date, Index, String, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.admission_period import AdmissionPeriod


class AcademicYear(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An academic year (e.g. 2026/2027) bounding admission periods."""

    __tablename__ = "academic_years"
    __table_args__ = (
        CheckConstraint(
            "start_date < end_date",
            name="ck_academic_years_start_before_end",
        ),
        Index(
            "uq_academic_years_single_active",
            "is_active",
            unique=True,
            postgresql_where=text("is_active = TRUE"),
        ),
    )

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=false(), default=False
    )

    admission_periods: Mapped[list["AdmissionPeriod"]] = relationship(
        "AdmissionPeriod",
        back_populates="academic_year",
        cascade="all, delete-orphan",
        order_by="AdmissionPeriod.registration_start",
    )

