"""Pydantic request and response schemas."""

from app.schemas.academic_year import (
    AcademicYearCreate,
    AcademicYearListResponse,
    AcademicYearResponse,
    AcademicYearUpdate,
)
from app.schemas.admission_period import (
    AdmissionPeriodAvailabilityResponse,
    AdmissionPeriodCreate,
    AdmissionPeriodListResponse,
    AdmissionPeriodResponse,
    AdmissionPeriodUpdate,
    AvailabilityStatus,
)
from app.schemas.applicant import (
    ApplicantCreate,
    ApplicantListResponse,
    ApplicantResponse,
    ApplicantUpdate,
)
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    UserProfile,
)
from app.schemas.common import (
    BaseSchema,
    ErrorDetail,
    ErrorEnvelope,
    HealthResponse,
    PaginatedResponse,
    PaginationMeta,
    ReadyResponse,
)
from app.schemas.guardian import (
    GuardianCreate,
    GuardianRelationship,
    GuardianResponse,
    GuardianUpdate,
)

__all__ = [
    "AcademicYearCreate",
    "AcademicYearListResponse",
    "AcademicYearResponse",
    "AcademicYearUpdate",
    "AdmissionPeriodAvailabilityResponse",
    "AdmissionPeriodCreate",
    "AdmissionPeriodListResponse",
    "AdmissionPeriodResponse",
    "AdmissionPeriodUpdate",
    "ApplicantCreate",
    "ApplicantListResponse",
    "ApplicantResponse",
    "ApplicantUpdate",
    "AvailabilityStatus",
    "BaseSchema",
    "ErrorDetail",
    "ErrorEnvelope",
    "GuardianCreate",
    "GuardianRelationship",
    "GuardianResponse",
    "GuardianUpdate",
    "HealthResponse",
    "LoginRequest",
    "PaginatedResponse",
    "PaginationMeta",
    "ReadyResponse",
    "RegisterRequest",
    "UserProfile",
]
