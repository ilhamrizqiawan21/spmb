"""Guardian management endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.user import User
from app.permissions.dependencies import get_current_user
from app.repositories.applicant_repository import ApplicantRepository
from app.repositories.guardian_repository import GuardianRepository
from app.schemas.guardian import GuardianCreate, GuardianResponse, GuardianUpdate
from app.services.guardian_service import GuardianService

router = APIRouter(prefix="/applicants/{applicant_id}/guardians", tags=["guardians"])


def _get_guardian_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> GuardianService:
    return GuardianService(
        guardians=GuardianRepository(session),
        applicants=ApplicantRepository(session),
    )


@router.post(
    "",
    response_model=GuardianResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_guardian(
    applicant_id: UUID,
    payload: GuardianCreate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[GuardianService, Depends(_get_guardian_service)],
) -> GuardianResponse:
    guardian = await service.create_guardian(user, applicant_id, payload)
    await session.commit()
    return GuardianResponse.model_validate(guardian)


@router.get("", response_model=list[GuardianResponse])
async def list_guardians(
    applicant_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[GuardianService, Depends(_get_guardian_service)],
) -> list[GuardianResponse]:
    guardians = await service.list_guardians(user, applicant_id)
    return [GuardianResponse.model_validate(g) for g in guardians]


@router.get("/{id}", response_model=GuardianResponse)
async def get_guardian(
    applicant_id: UUID,
    id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[GuardianService, Depends(_get_guardian_service)],
) -> GuardianResponse:
    guardian = await service.get_guardian(user, applicant_id, id)
    return GuardianResponse.model_validate(guardian)


@router.patch("/{id}", response_model=GuardianResponse)
async def update_guardian(
    applicant_id: UUID,
    id: UUID,
    payload: GuardianUpdate,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[GuardianService, Depends(_get_guardian_service)],
) -> GuardianResponse:
    guardian = await service.update_guardian(user, applicant_id, id, payload)
    await session.commit()
    return GuardianResponse.model_validate(guardian)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_guardian(
    applicant_id: UUID,
    id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[GuardianService, Depends(_get_guardian_service)],
) -> None:
    await service.delete_guardian(user, applicant_id, id)
    await session.commit()
