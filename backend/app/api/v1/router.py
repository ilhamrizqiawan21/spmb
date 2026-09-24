"""Versioned API router assembly point."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    academic_years,
    admission_periods,
    applicants,
    auth,
    guardians,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(academic_years.router)
api_router.include_router(admission_periods.router)
api_router.include_router(applicants.router)
api_router.include_router(guardians.router)
