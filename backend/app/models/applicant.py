"""Applicant model for storing student identity data owned by parents."""

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKeyConstraint, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.guardian import Guardian
    from app.models.user import User


class Applicant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """An applicant / student profile owned and registered by a parent user."""

    __tablename__ = "applicants"
    __table_args__ = (
        ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_applicants_owner_user_id_users",
            ondelete="RESTRICT",
        ),
        Index("ix_applicants_owner_user_id", "owner_user_id"),
    )

    owner_user_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    nisn: Mapped[str | None] = mapped_column(String(20), nullable=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gender: Mapped[str] = mapped_column(String(20), nullable=False)
    birth_place: Mapped[str] = mapped_column(String(150), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    religion: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nationality: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default="Indonesia", default="Indonesia"
    )
    nik: Mapped[str | None] = mapped_column(String(30), nullable=True)
    family_card_number: Mapped[str | None] = mapped_column(String(30), nullable=True)

    address: Mapped[str] = mapped_column(Text, nullable=False)
    province: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village: Mapped[str | None] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(10), nullable=True)

    previous_school_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    previous_school_npsn: Mapped[str | None] = mapped_column(String(30), nullable=True)
    previous_school_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_user_id])
    guardians: Mapped[list["Guardian"]] = relationship(
        "Guardian",
        back_populates="applicant",
        cascade="all, delete-orphan",
        order_by="Guardian.created_at",
        lazy="selectin",
    )
