"""Admission Period management and availability endpoints."""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.permissions.dependencies import require_permission
from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.schemas.admission_period import (
    AdmissionPeriodAvailabilityResponse,
    AdmissionPeriodCreate,
    AdmissionPeriodListResponse,
    AdmissionPeriodResponse,
    AdmissionPeriodUpdate,
)
from app.schemas.common import PaginationMeta
from app.services.admission_period_service import AdmissionPeriodService
from app.services.registration_availability_service import (
    RegistrationAvailabilityService,
)

router = APIRouter(prefix="/admission-periods", tags=["admission-periods"])


def _get_admission_period_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdmissionPeriodService:
    return AdmissionPeriodService(
        admission_periods=AdmissionPeriodRepository(session),
        academic_years=AcademicYearRepository(session),
    )


def _get_registration_availability_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RegistrationAvailabilityService:
    return RegistrationAvailabilityService(
        admission_periods=AdmissionPeriodRepository(session),
        academic_years=AcademicYearRepository(session),
    )


@router.post(
    "",
    response_model=AdmissionPeriodResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("admission_period.manage"))],
)
async def create_admission_period(
    payload: AdmissionPeriodCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AdmissionPeriodService, Depends(_get_admission_period_service)],
) -> AdmissionPeriodResponse:
    period = await service.create(payload)
    await session.commit()
    return AdmissionPeriodResponse.model_validate(period)


@router.get("", response_model=AdmissionPeriodListResponse)
async def list_admission_periods(
    service: Annotated[AdmissionPeriodService, Depends(_get_admission_period_service)],
    academic_year_id: UUID | None = None,
    is_active: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> AdmissionPeriodListResponse:
    skip = (page - 1) * limit
    items, total = await service.list(
        academic_year_id=academic_year_id,
        is_active=is_active,
        skip=skip,
        limit=limit,
    )
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return AdmissionPeriodListResponse(
        items=[AdmissionPeriodResponse.model_validate(item) for item in items],
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )


@router.get("/open", response_model=list[AdmissionPeriodResponse])
async def list_open_admission_periods(
    availability_service: Annotated[
        RegistrationAvailabilityService, Depends(_get_registration_availability_service)
    ],
) -> list[AdmissionPeriodResponse]:
    periods = await availability_service.get_open_periods()
    return [AdmissionPeriodResponse.model_validate(period) for period in periods]


@router.get("/{id}", response_model=AdmissionPeriodResponse)
async def get_admission_period(
    id: UUID,
    service: Annotated[AdmissionPeriodService, Depends(_get_admission_period_service)],
) -> AdmissionPeriodResponse:
    period = await service.get_by_id(id)
    return AdmissionPeriodResponse.model_validate(period)


@router.get(
    "/{id}/availability",
    response_model=AdmissionPeriodAvailabilityResponse,
)
async def get_admission_period_availability(
    id: UUID,
    availability_service: Annotated[
        RegistrationAvailabilityService, Depends(_get_registration_availability_service)
    ],
) -> AdmissionPeriodAvailabilityResponse:
    return await availability_service.get_period_availability(id)


@router.patch(
    "/{id}",
    response_model=AdmissionPeriodResponse,
    dependencies=[Depends(require_permission("admission_period.manage"))],
)
async def update_admission_period(
    id: UUID,
    payload: AdmissionPeriodUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AdmissionPeriodService, Depends(_get_admission_period_service)],
) -> AdmissionPeriodResponse:
    period = await service.update(id, payload)
    await session.commit()
    return AdmissionPeriodResponse.model_validate(period)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("admission_period.manage"))],
)
async def delete_admission_period(
    id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AdmissionPeriodService, Depends(_get_admission_period_service)],
) -> None:
    await service.delete(id)
    await session.commit()
