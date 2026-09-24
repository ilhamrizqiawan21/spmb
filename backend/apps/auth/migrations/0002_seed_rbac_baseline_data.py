"""Seed RBAC baseline data: system roles and permissions."""

import uuid
from typing import Any

from django.db import migrations

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


def _role_id(code: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, f"spmb:role:{code}")


def _permission_id(code: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, f"spmb:permission:{code}")


def seed_rbac(apps: Any, schema_editor: Any) -> None:
    Role = apps.get_model("spmb_auth", "Role")
    Permission = apps.get_model("spmb_auth", "Permission")
    RolePermission = apps.get_model("spmb_auth", "RolePermission")

    role_objs = {}
    for code in ROLE_CODES:
        role, _ = Role.objects.get_or_create(
            id=_role_id(code),
            defaults={
                "code": code,
                "name": ROLE_NAMES[code],
                "is_system": True,
            },
        )
        role_objs[code] = role

    perm_objs = {}
    for code in PERMISSION_CODES:
        perm, _ = Permission.objects.get_or_create(
            id=_permission_id(code),
            defaults={
                "code": code,
                "name": code.replace(".", " ").replace("_", " ").title(),
            },
        )
        perm_objs[code] = perm

    for role_code, perms in ROLE_PERMISSIONS.items():
        role = role_objs[role_code]
        for perm_code in perms:
            perm = perm_objs[perm_code]
            rp_id = uuid.uuid5(_NAMESPACE, f"spmb:role_permission:{role_code}:{perm_code}")
            RolePermission.objects.get_or_create(
                id=rp_id,
                defaults={
                    "role": role,
                    "permission": perm,
                },
            )


def unseed_rbac(apps: Any, schema_editor: Any) -> None:
    Role = apps.get_model("spmb_auth", "Role")
    Permission = apps.get_model("spmb_auth", "Permission")
    RolePermission = apps.get_model("spmb_auth", "RolePermission")

    role_ids = [_role_id(code) for code in ROLE_CODES]
    permission_ids = [_permission_id(code) for code in PERMISSION_CODES]

    RolePermission.objects.filter(role_id__in=role_ids).delete()
    Permission.objects.filter(id__in=permission_ids).delete()
    Role.objects.filter(id__in=role_ids).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("spmb_auth", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_rbac, reverse_code=unseed_rbac),
    ]
