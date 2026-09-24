"""Academic Year management endpoints."""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.core.errors import NotFoundException
from app.permissions.dependencies import require_permission
from app.repositories.academic_year_repository import AcademicYearRepository
from app.repositories.admission_period_repository import AdmissionPeriodRepository
from app.schemas.academic_year import (
    AcademicYearCreate,
    AcademicYearListResponse,
    AcademicYearResponse,
    AcademicYearUpdate,
)
from app.schemas.common import PaginationMeta
from app.services.academic_year_service import AcademicYearService

router = APIRouter(prefix="/academic-years", tags=["academic-years"])


def _get_academic_year_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AcademicYearService:
    return AcademicYearService(
        academic_years=AcademicYearRepository(session),
        admission_periods=AdmissionPeriodRepository(session),
    )


@router.post(
    "",
    response_model=AcademicYearResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic_year.manage"))],
)
async def create_academic_year(
    payload: AcademicYearCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AcademicYearService, Depends(_get_academic_year_service)],
) -> AcademicYearResponse:
    academic_year = await service.create(payload)
    await session.commit()
    return AcademicYearResponse.model_validate(academic_year)


@router.get("", response_model=AcademicYearListResponse)
async def list_academic_years(
    service: Annotated[AcademicYearService, Depends(_get_academic_year_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    is_active: bool | None = None,
) -> AcademicYearListResponse:
    skip = (page - 1) * limit
    items, total = await service.list(skip=skip, limit=limit, is_active=is_active)
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return AcademicYearListResponse(
        items=[AcademicYearResponse.model_validate(item) for item in items],
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )


@router.get("/active", response_model=AcademicYearResponse)
async def get_active_academic_year(
    service: Annotated[AcademicYearService, Depends(_get_academic_year_service)],
) -> AcademicYearResponse:
    active_year = await service.get_active()
    if active_year is None:
        raise NotFoundException(
            "No active academic year found.", code="NO_ACTIVE_ACADEMIC_YEAR"
        )
    return AcademicYearResponse.model_validate(active_year)


@router.get("/{id}", response_model=AcademicYearResponse)
async def get_academic_year(
    id: UUID,
    service: Annotated[AcademicYearService, Depends(_get_academic_year_service)],
) -> AcademicYearResponse:
    academic_year = await service.get_by_id(id)
    return AcademicYearResponse.model_validate(academic_year)


@router.patch(
    "/{id}",
    response_model=AcademicYearResponse,
    dependencies=[Depends(require_permission("academic_year.manage"))],
)
async def update_academic_year(
    id: UUID,
    payload: AcademicYearUpdate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AcademicYearService, Depends(_get_academic_year_service)],
) -> AcademicYearResponse:
    academic_year = await service.update(id, payload)
    await session.commit()
    return AcademicYearResponse.model_validate(academic_year)


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("academic_year.manage"))],
)
async def delete_academic_year(
    id: UUID,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AcademicYearService, Depends(_get_academic_year_service)],
) -> None:
    await service.delete(id)
    await session.commit()
