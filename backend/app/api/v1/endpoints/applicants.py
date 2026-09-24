"""Applicant profile management endpoints."""

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.user import User
from app.permissions.dependencies import get_current_user
from app.repositories.applicant_repository import ApplicantRepository
from app.schemas.applicant import (
    ApplicantCreate,
    ApplicantListResponse,
    ApplicantResponse,
    ApplicantUpdate,
)
from app.schemas.common import PaginationMeta
from app.services.applicant_service import ApplicantService

router = APIRouter(prefix="/applicants", tags=["applicants"])


def _get_applicant_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicantService:
    return ApplicantService(applicants=ApplicantRepository(session))


@router.post(
    "",
    response_model=ApplicantResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_applicant(
    payload: ApplicantCreate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[ApplicantService, Depends(_get_applicant_service)],
) -> ApplicantResponse:
    applicant = await service.create_for_user(user, payload)
    await session.commit()
    return ApplicantResponse.model_validate(applicant)


@router.get("", response_model=ApplicantListResponse)
async def list_applicants(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ApplicantService, Depends(_get_applicant_service)],
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    search: str | None = None,
) -> ApplicantListResponse:
    skip = (page - 1) * limit
    items, total = await service.list_for_user(
        user=user, skip=skip, limit=limit, search=search
    )
    total_pages = math.ceil(total / limit) if total > 0 else 0
    return ApplicantListResponse(
        items=[ApplicantResponse.model_validate(item) for item in items],
        meta=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
        ),
    )


@router.get("/{id}", response_model=ApplicantResponse)
async def get_applicant(
    id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[ApplicantService, Depends(_get_applicant_service)],
) -> ApplicantResponse:
    applicant = await service.get_by_id(user, id)
    return ApplicantResponse.model_validate(applicant)


@router.patch("/{id}", response_model=ApplicantResponse)
async def update_applicant(
    id: UUID,
    payload: ApplicantUpdate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[ApplicantService, Depends(_get_applicant_service)],
) -> ApplicantResponse:
    applicant = await service.update(user, id, payload)
    await session.commit()
    return ApplicantResponse.model_validate(applicant)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_applicant(
    id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[ApplicantService, Depends(_get_applicant_service)],
) -> None:
    await service.delete(user, id)
    await session.commit()
