"""Guardian model representing father, mother, or legal guardian of an applicant."""

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import relationship as sa_relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.applicant import Applicant


class Guardian(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Parent or legal guardian associated with an applicant."""

    __tablename__ = "guardians"
    __table_args__ = (
        ForeignKeyConstraint(
            ["applicant_id"],
            ["applicants.id"],
            name="fk_guardians_applicant_id_applicants",
            ondelete="CASCADE",
        ),
        CheckConstraint(
            "relationship IN ('FATHER', 'MOTHER', 'GUARDIAN')",
            name="ck_guardians_relationship",
        ),
        UniqueConstraint(
            "applicant_id",
            "relationship",
            name="uq_guardians_applicant_relationship",
        ),
        Index("ix_guardians_applicant_id", "applicant_id"),
    )

    applicant_id: Mapped[UUID] = mapped_column(PostgreSQLUUID(as_uuid=True), nullable=False)
    relationship: Mapped[str] = mapped_column(String(30), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    nik: Mapped[str | None] = mapped_column(String(30), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    occupation: Mapped[str | None] = mapped_column(String(150), nullable=True)
    education: Mapped[str | None] = mapped_column(String(100), nullable=True)
    monthly_income: Mapped[Decimal | None] = mapped_column(Numeric(15, 2), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_primary_contact: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=false(), default=False
    )

    applicant: Mapped["Applicant"] = sa_relationship("Applicant", back_populates="guardians")
