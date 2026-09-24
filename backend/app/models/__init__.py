"""SQLAlchemy ORM models."""

from app.models.academic_year import AcademicYear
from app.models.admission_period import AdmissionPeriod
from app.models.applicant import Applicant
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.guardian import Guardian
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.user_role import UserRole

__all__ = [
    "AcademicYear",
    "AdmissionPeriod",
    "Applicant",
    "Base",
    "Guardian",
    "Permission",
    "Role",
    "RolePermission",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "User",
    "UserRole",
]
