"""Business logic for Applicant management and ownership enforcement."""

from uuid import UUID

from app.core.errors import NotFoundException, PermissionDeniedException
from app.models.applicant import Applicant
from app.models.user import User
from app.repositories.applicant_repository import ApplicantRepository
from app.schemas.applicant import ApplicantCreate, ApplicantUpdate


def user_has_permission(user: User, code: str) -> bool:
    """Return True if user holds the specified permission code."""
    return any(
        permission.code == code
        for role in getattr(user, "roles", [])
        for permission in getattr(role, "permissions", [])
    )


class ApplicantService:
    """Service governing applicant profiles, access control, and editability."""

    def __init__(self, applicants: ApplicantRepository) -> None:
        self._applicants = applicants

    async def create_for_user(self, user: User, data: ApplicantCreate) -> Applicant:
        """Create a new applicant profile belonging to the current user."""
        applicant = Applicant(
            owner_user_id=user.id,
            nisn=data.nisn,
            full_name=data.full_name,
            nickname=data.nickname,
            gender=data.gender,
            birth_place=data.birth_place,
            birth_date=data.birth_date,
            religion=data.religion,
            nationality=data.nationality,
            nik=data.nik,
            family_card_number=data.family_card_number,
            address=data.address,
            province=data.province,
            city=data.city,
            district=data.district,
            village=data.village,
            postal_code=data.postal_code,
            previous_school_name=data.previous_school_name,
            previous_school_npsn=data.previous_school_npsn,
            previous_school_address=data.previous_school_address,
        )
        return await self._applicants.create(applicant)

    async def get_by_id(self, user: User, id: UUID) -> Applicant:
        """Retrieve applicant profile verifying ownership or staff permission."""
        applicant = await self._applicants.get_by_id(id, include_guardians=True)
        if applicant is None:
            raise NotFoundException("Applicant not found.", code="APPLICANT_NOT_FOUND")

        is_owner = applicant.owner_user_id == user.id
        can_read_all = user_has_permission(user, "application.read")

        if not is_owner and not can_read_all:
            raise PermissionDeniedException(
                "You do not have permission to view this applicant.",
                code="PERMISSION_DENIED",
            )

        return applicant

    async def list_for_user(
        self,
        user: User,
        skip: int = 0,
        limit: int = 50,
        search: str | None = None,
    ) -> tuple[list[Applicant], int]:
        """List applicants: own children for parents, or all for authorized staff."""
        if user_has_permission(user, "application.read"):
            return await self._applicants.list_all(
                skip=skip, limit=limit, search=search, include_guardians=True
            )
        return await self._applicants.list_by_owner(
            owner_user_id=user.id, skip=skip, limit=limit, include_guardians=True
        )

    async def update(self, user: User, id: UUID, data: ApplicantUpdate) -> Applicant:
        """Update applicant details if editable and user is owner or has override right."""
        applicant = await self._applicants.get_by_id(id, include_guardians=True)
        if applicant is None:
            raise NotFoundException("Applicant not found.", code="APPLICANT_NOT_FOUND")

        is_owner = applicant.owner_user_id == user.id
        can_override = user_has_permission(user, "application.override")

        if not is_owner and not can_override:
            raise PermissionDeniedException(
                "You do not have permission to modify this applicant.",
                code="PERMISSION_DENIED",
            )

        fields_to_update = data.model_dump(exclude_unset=True)
        for key, value in fields_to_update.items():
            setattr(applicant, key, value)

        return await self._applicants.update(applicant)

    async def delete(self, user: User, id: UUID) -> None:
        """Delete applicant if owned and not locked in an active admission workflow."""
        applicant = await self._applicants.get_by_id(id)
        if applicant is None:
            raise NotFoundException("Applicant not found.", code="APPLICANT_NOT_FOUND")

        is_owner = applicant.owner_user_id == user.id
        can_override = user_has_permission(user, "application.override")

        if not is_owner and not can_override:
            raise PermissionDeniedException(
                "You do not have permission to delete this applicant.",
                code="PERMISSION_DENIED",
            )

        await self._applicants.delete(applicant)
