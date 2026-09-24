"""Domain service layer."""

from app.services.academic_year_service import AcademicYearService
from app.services.admission_period_service import AdmissionPeriodService
from app.services.applicant_service import ApplicantService, user_has_permission
from app.services.auth_service import AuthService
from app.services.guardian_service import GuardianService
from app.services.registration_availability_service import (
    RegistrationAvailabilityService,
)

__all__ = [
    "AcademicYearService",
    "AdmissionPeriodService",
    "ApplicantService",
    "AuthService",
    "GuardianService",
    "RegistrationAvailabilityService",
    "user_has_permission",
]
