"""create applicants and guardians tables

Revision ID: c7b2a9e34513
Revises: c7b2a9e34512
Create Date: 2026-09-24 01:00:00.000000

Creates applicants and guardians tables with constraints, indexes,
and foreign key relationships.
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "c7b2a9e34513"
down_revision = "c7b2a9e34512"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. applicants table
    op.create_table(
        "applicants",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nisn", sa.String(length=20), nullable=True),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("nickname", sa.String(length=100), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=False),
        sa.Column("birth_place", sa.String(length=150), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("religion", sa.String(length=50), nullable=True),
        sa.Column(
            "nationality",
            sa.String(length=50),
            server_default="Indonesia",
            nullable=False,
        ),
        sa.Column("nik", sa.String(length=30), nullable=True),
        sa.Column("family_card_number", sa.String(length=30), nullable=True),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("province", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("district", sa.String(length=100), nullable=True),
        sa.Column("village", sa.String(length=100), nullable=True),
        sa.Column("postal_code", sa.String(length=10), nullable=True),
        sa.Column("previous_school_name", sa.String(length=200), nullable=True),
        sa.Column("previous_school_npsn", sa.String(length=30), nullable=True),
        sa.Column("previous_school_address", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_applicants_owner_user_id_users",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_applicants"),
    )
    op.create_index(
        "ix_applicants_owner_user_id", "applicants", ["owner_user_id"]
    )

    # 2. guardians table
    op.create_table(
        "guardians",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("applicant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relationship", sa.String(length=30), nullable=False),
        sa.Column("full_name", sa.String(length=200), nullable=False),
        sa.Column("nik", sa.String(length=30), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("occupation", sa.String(length=150), nullable=True),
        sa.Column("education", sa.String(length=100), nullable=True),
        sa.Column("monthly_income", sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column(
            "is_primary_contact",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["applicant_id"],
            ["applicants.id"],
            name="fk_guardians_applicant_id_applicants",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "relationship IN ('FATHER', 'MOTHER', 'GUARDIAN')",
            name="ck_guardians_relationship",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_guardians"),
    )
    op.create_unique_constraint(
        "uq_guardians_applicant_relationship",
        "guardians",
        ["applicant_id", "relationship"],
    )
    op.create_index(
        "ix_guardians_applicant_id", "guardians", ["applicant_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_guardians_applicant_id", table_name="guardians")
    op.drop_constraint("uq_guardians_applicant_relationship", "guardians", type_="unique")
    op.drop_table("guardians")

    op.drop_index("ix_applicants_owner_user_id", table_name="applicants")
    op.drop_table("applicants")
