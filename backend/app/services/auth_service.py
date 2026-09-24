"""Business logic for registration, authentication, and session lifecycle."""

from app.core.errors import AuthenticationException, ConflictException
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_password, validate_password_strength, verify_password
from app.core.session import create_session, delete_session
from app.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserProfile

DEFAULT_PARENT_ROLE_CODE = "parent"
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 900


class AuthService:
    """Registration, login, logout, and profile assembly for user accounts."""

    def __init__(self, users: UserRepository, roles: RoleRepository) -> None:
        self._users = users
        self._roles = roles

    async def register(self, data: RegisterRequest) -> User:
        validate_password_strength(data.password)

        if data.email and await self._users.get_by_email(data.email) is not None:
            raise ConflictException("Email is already registered.", code="EMAIL_TAKEN")
        if data.phone and await self._users.get_by_phone(data.phone) is not None:
            raise ConflictException("Phone number is already registered.", code="PHONE_TAKEN")

        user = User(
            name=data.name,
            email=data.email,
            phone=data.phone,
            password_hash=hash_password(data.password),
        )
        await self._users.create(user)

        parent_role = await self._roles.get_by_code(DEFAULT_PARENT_ROLE_CODE)
        if parent_role is None:
            raise ConflictException(
                "Default parent role is not configured.", code="ROLE_NOT_CONFIGURED"
            )
        await self._roles.assign_role_to_user(user.id, parent_role.id)

        reloaded = await self._users.get_by_id(user.id)
        if reloaded is None:  # pragma: no cover - defensive, cannot happen
            raise ConflictException("Failed to load the newly registered user.")
        return reloaded

    async def authenticate(self, data: LoginRequest) -> tuple[User, str]:
        await enforce_rate_limit(
            f"login:{data.identifier.strip().lower()}",
            max_attempts=LOGIN_MAX_ATTEMPTS,
            window_seconds=LOGIN_WINDOW_SECONDS,
        )

        user = await self._users.get_by_email(
            data.identifier
        ) or await self._users.get_by_phone(data.identifier)

        if user is None or not verify_password(data.password, user.password_hash):
            raise AuthenticationException("Invalid credentials.")
        if not user.is_active:
            raise AuthenticationException("This account is inactive.", code="ACCOUNT_INACTIVE")

        await self._users.mark_logged_in(user)
        token = await create_session(user.id)
        return user, token

    async def logout(self, token: str) -> None:
        await delete_session(token)

    def build_profile(self, user: User) -> UserProfile:
        role_codes = [role.code for role in user.roles]
        permission_codes = sorted(
            {permission.code for role in user.roles for permission in role.permissions}
        )
        return UserProfile(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            is_active=user.is_active,
            roles=role_codes,
            permissions=permission_codes,
        )
