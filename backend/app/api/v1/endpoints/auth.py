"""Authentication endpoints: register, login, logout, current user."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session
from app.core.session import SESSION_COOKIE_NAME, SESSION_TTL
from app.models.user import User
from app.permissions.dependencies import get_current_user
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserProfile
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_auth_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthService:
    return AuthService(UserRepository(session), RoleRepository(session))


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=settings.app_env == "production",
        samesite="lax",
        path="/",
    )


@router.post(
    "/register",
    response_model=UserProfile,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AuthService, Depends(_get_auth_service)],
) -> UserProfile:
    user = await service.register(payload)
    await session.commit()
    return service.build_profile(user)


@router.post("/login", response_model=UserProfile)
async def login(
    payload: LoginRequest,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_db_session)],
    service: Annotated[AuthService, Depends(_get_auth_service)],
) -> UserProfile:
    user, token = await service.authenticate(payload)
    await session.commit()
    _set_session_cookie(response, token)
    return service.build_profile(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    service: Annotated[AuthService, Depends(_get_auth_service)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> None:
    if session_token is not None:
        await service.logout(session_token)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


@router.get("/me", response_model=UserProfile)
async def me(
    user: Annotated[User, Depends(get_current_user)],
    service: Annotated[AuthService, Depends(_get_auth_service)],
) -> UserProfile:
    return service.build_profile(user)
