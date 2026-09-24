"""Persistence repositories."""

from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.repositories.applicant_repository import ApplicantRepository
from app.repositories.guardian_repository import GuardianRepository
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository

__all__ = [
    "AcademicYearRepository",
    "AdmissionPeriodRepository",
    "ApplicantRepository",
    "GuardianRepository",
    "RoleRepository",
    "UserRepository",
]
