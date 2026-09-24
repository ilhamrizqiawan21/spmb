"""seed rbac baseline data

Revision ID: 42a959998a57
Revises: f5e3162632a8
Create Date: 2026-09-23 00:20:00.000000

Seeds the initial system roles (AGENTS.md #6/#3.2) and baseline permission
codes (AGENTS.md #17 / AI_RULES.md #13). The role -> permission grants below
are a first-cut development baseline, not a spec'd business rule from the
PRD/ERD; adjust via the admin RBAC UI once it exists, not by editing this
migration.
"""

import uuid

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "42a959998a57"
down_revision = "f5e3162632a8"
branch_labels = None
depends_on = None

_NAMESPACE = uuid.NAMESPACE_URL

ROLE_CODES = [
    "super_admin",
    "admission_admin",
    "verifier",
    "finance",
    "assessor",
    "principal",
    "mpls_officer",
    "parent",
]

PERMISSION_CODES = [
    "application.read",
    "application.verify",
    "application.override",
    "document.verify",
    "payment.verify",
    "assessment.input",
    "assessment.approve",
    "announcement.publish",
    "enrollment.manage",
    "mpls.manage",
    "user.manage",
    "audit.read",
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "super_admin": list(PERMISSION_CODES),
    "admission_admin": [
        "application.read",
        "application.verify",
        "application.override",
        "document.verify",
        "announcement.publish",
        "enrollment.manage",
        "user.manage",
        "audit.read",
    ],
    "verifier": ["application.read", "document.verify"],
    "finance": ["application.read", "payment.verify"],
    "assessor": ["application.read", "assessment.input"],
    "principal": [
        "application.read",
        "assessment.approve",
        "application.override",
        "announcement.publish",
        "audit.read",
    ],
    "mpls_officer": ["application.read", "mpls.manage"],
    "parent": [],
}

ROLE_NAMES = {
    "super_admin": "Super Admin",
    "admission_admin": "Admission Admin",
    "verifier": "Verifier",
    "finance": "Finance",
    "assessor": "Assessor",
    "principal": "Principal",
    "mpls_officer": "MPLS Officer",
    "parent": "Parent",
}


def _role_id(code: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, f"spmb:role:{code}")


def _permission_id(code: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, f"spmb:permission:{code}")


roles_table = sa.table(
    "roles",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("code", sa.String),
    sa.column("is_system", sa.Boolean),
)

permissions_table = sa.table(
    "permissions",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("code", sa.String),
    sa.column("name", sa.String),
)

role_permissions_table = sa.table(
    "role_permissions",
    sa.column("id", postgresql.UUID(as_uuid=True)),
    sa.column("role_id", postgresql.UUID(as_uuid=True)),
    sa.column("permission_id", postgresql.UUID(as_uuid=True)),
)


def upgrade() -> None:
    op.bulk_insert(
        roles_table,
        [
            {
                "id": _role_id(code),
                "name": ROLE_NAMES[code],
                "code": code,
                "is_system": True,
            }
            for code in ROLE_CODES
        ],
    )
    op.bulk_insert(
        permissions_table,
        [
            {
                "id": _permission_id(code),
                "code": code,
                "name": code.replace(".", " ").replace("_", " ").title(),
            }
            for code in PERMISSION_CODES
        ],
    )
    op.bulk_insert(
        role_permissions_table,
        [
            {
                "id": uuid.uuid5(_NAMESPACE, f"spmb:role_permission:{role_code}:{permission_code}"),
                "role_id": _role_id(role_code),
                "permission_id": _permission_id(permission_code),
            }
            for role_code, permission_codes in ROLE_PERMISSIONS.items()
            for permission_code in permission_codes
        ],
    )


def downgrade() -> None:
    role_ids = [_role_id(code) for code in ROLE_CODES]
    permission_ids = [_permission_id(code) for code in PERMISSION_CODES]
    op.execute(
        role_permissions_table.delete().where(
            role_permissions_table.c.role_id.in_(role_ids)
        )
    )
    op.execute(permissions_table.delete().where(permissions_table.c.id.in_(permission_ids)))
    op.execute(roles_table.delete().where(roles_table.c.id.in_(role_ids)))
