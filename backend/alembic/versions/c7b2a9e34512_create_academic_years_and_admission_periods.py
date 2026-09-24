"""create academic_years and admission_periods tables

Revision ID: c7b2a9e34512
Revises: 42a959998a57
Create Date: 2026-09-24 00:00:00.000000

Creates academic_years and admission_periods tables, adds constraints,
creates single-active partial index, and seeds academic_year.manage and
admission_period.manage permissions for super_admin and admission_admin.
"""

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "c7b2a9e34512"
down_revision = "42a959998a57"
branch_labels = None
depends_on = None

_NAMESPACE = uuid.NAMESPACE_URL

NEW_PERMISSIONS = [
    {
        "code": "academic_year.manage",
        "name": "Manage Academic Years",
        "description": "Create, update, activate, and delete academic years",
    },
    {
        "code": "admission_period.manage",
        "name": "Manage Admission Periods",
        "description": "Create, update, configure, and delete admission periods and waves",
    },
]

GRANTED_ROLES = ["super_admin", "admission_admin"]


def _permission_id(code: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, f"spmb:permission:{code}")


def _role_id(code: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, f"spmb:role:{code}")


def upgrade() -> None:
    # 1. academic_years table
    op.create_table(
        "academic_years",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.false(), nullable=False
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
        sa.CheckConstraint(
            "start_date < end_date",
            name="ck_academic_years_start_before_end",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_academic_years"),
    )
    op.create_unique_constraint(
        "uq_academic_years_name", "academic_years", ["name"]
    )
    op.create_index(
        "uq_academic_years_single_active",
        "academic_years",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active = TRUE"),
    )

    # 2. admission_periods table
    op.create_table(
        "admission_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("registration_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("registration_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("announcement_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("quota", sa.Integer(), nullable=True),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.true(), nullable=False
        ),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
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
            ["academic_year_id"],
            ["academic_years.id"],
            name="fk_admission_periods_academic_year_id_academic_years",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "registration_start < registration_end",
            name="ck_admission_periods_start_before_end",
        ),
        sa.CheckConstraint(
            "quota IS NULL OR quota >= 0",
            name="ck_admission_periods_quota_non_negative",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_admission_periods"),
    )
    op.create_unique_constraint(
        "uq_admission_periods_academic_year_code",
        "admission_periods",
        ["academic_year_id", "code"],
    )
    op.create_index(
        "ix_admission_periods_academic_year_id",
        "admission_periods",
        ["academic_year_id"],
    )

    # 3. Seed new permissions
    permissions_table = sa.table(
        "permissions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
    )
    role_permissions_table = sa.table(
        "role_permissions",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("role_id", postgresql.UUID(as_uuid=True)),
        sa.column("permission_id", postgresql.UUID(as_uuid=True)),
    )

    perm_rows = [
        {
            "id": _permission_id(p["code"]),
            "code": p["code"],
            "name": p["name"],
            "description": p["description"],
        }
        for p in NEW_PERMISSIONS
    ]
    op.bulk_insert(permissions_table, perm_rows)

    grant_rows = []
    for role_code in GRANTED_ROLES:
        role_uuid = _role_id(role_code)
        for p in NEW_PERMISSIONS:
            perm_uuid = _permission_id(p["code"])
            link_uuid = uuid.uuid5(_NAMESPACE, f"spmb:grant:{role_code}:{p['code']}")
            grant_rows.append(
                {
                    "id": link_uuid,
                    "role_id": role_uuid,
                    "permission_id": perm_uuid,
                }
            )
    op.bulk_insert(role_permissions_table, grant_rows)


def downgrade() -> None:
    # 1. Clean up seeded permissions and role_permissions
    perm_ids = [_permission_id(p["code"]) for p in NEW_PERMISSIONS]
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM role_permissions WHERE permission_id = ANY(:ids)"),
        {"ids": perm_ids},
    )
    conn.execute(
        sa.text("DELETE FROM permissions WHERE id = ANY(:ids)"),
        {"ids": perm_ids},
    )

    # 2. Drop admission_periods
    op.drop_index("ix_admission_periods_academic_year_id", table_name="admission_periods")
    op.drop_constraint("uq_admission_periods_academic_year_code", "admission_periods", type_="unique")
    op.drop_table("admission_periods")

    # 3. Drop academic_years
    op.drop_index("uq_academic_years_single_active", table_name="academic_years")
    op.drop_constraint("uq_academic_years_name", "academic_years", type_="unique")
    op.drop_table("academic_years")
