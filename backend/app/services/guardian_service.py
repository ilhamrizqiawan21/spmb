"""Business logic for Guardian management and relationship rules."""

from uuid import UUID

from app.core.errors import ConflictException, NotFoundException, PermissionDeniedException
from app.models.guardian import Guardian
from app.models.user import User
from app.repositories.applicant_repository import ApplicantRepository
from app.repositories.guardian_repository import GuardianRepository
from app.schemas.guardian import GuardianCreate, GuardianUpdate
from app.services.applicant_service import user_has_permission


class GuardianService:
    """Service governing guardian profiles, relationship uniqueness, and contacts."""

    def __init__(
        self,
        guardians: GuardianRepository,
        applicants: ApplicantRepository,
    ) -> None:
        self._guardians = guardians
        self._applicants = applicants

    async def create_guardian(
        self, user: User, applicant_id: UUID, data: GuardianCreate
    ) -> Guardian:
        """Add a guardian to an applicant verifying parent ownership and relationship uniqueness."""
        applicant = await self._applicants.get_by_id(applicant_id)
        if applicant is None:
            raise NotFoundException("Applicant not found.", code="APPLICANT_NOT_FOUND")

        is_owner = applicant.owner_user_id == user.id
        can_override = user_has_permission(user, "application.override")
        if not is_owner and not can_override:
            raise PermissionDeniedException(
                "You do not have permission to add a guardian to this applicant.",
                code="PERMISSION_DENIED",
            )

        existing = await self._guardians.get_by_applicant_and_relationship(
            applicant_id, data.relationship
        )
        if existing is not None:
            raise ConflictException(
                f"A guardian with relationship '{data.relationship}' "
                "already exists for this child.",
                code="GUARDIAN_RELATIONSHIP_EXISTS",
            )

        if data.is_primary_contact:
            await self._guardians.clear_primary_contact(applicant_id)

        guardian = Guardian(
            applicant_id=applicant_id,
            relationship=data.relationship,
            full_name=data.full_name,
            nik=data.nik,
            phone=data.phone,
            email=data.email,
            occupation=data.occupation,
            education=data.education,
            monthly_income=data.monthly_income,
            address=data.address,
            is_primary_contact=data.is_primary_contact,
        )
        return await self._guardians.create(guardian)

    async def list_guardians(self, user: User, applicant_id: UUID) -> list[Guardian]:
        """List all guardians for an applicant verifying access."""
        applicant = await self._applicants.get_by_id(applicant_id)
        if applicant is None:
            raise NotFoundException("Applicant not found.", code="APPLICANT_NOT_FOUND")

        is_owner = applicant.owner_user_id == user.id
        can_read = user_has_permission(user, "application.read")
        if not is_owner and not can_read:
            raise PermissionDeniedException(
                "You do not have permission to view guardians for this applicant.",
                code="PERMISSION_DENIED",
            )

        return await self._guardians.list_by_applicant(applicant_id)

    async def get_guardian(
        self, user: User, applicant_id: UUID, guardian_id: UUID
    ) -> Guardian:
        """Get guardian details verifying ownership or read permission."""
        applicant = await self._applicants.get_by_id(applicant_id)
        if applicant is None:
            raise NotFoundException("Applicant not found.", code="APPLICANT_NOT_FOUND")

        is_owner = applicant.owner_user_id == user.id
        can_read = user_has_permission(user, "application.read")
        if not is_owner and not can_read:
            raise PermissionDeniedException(
                "You do not have permission to view this guardian.",
                code="PERMISSION_DENIED",
            )

        guardian = await self._guardians.get_by_id(guardian_id)
        if guardian is None or guardian.applicant_id != applicant_id:
            raise NotFoundException("Guardian not found.", code="GUARDIAN_NOT_FOUND")

        return guardian

    async def update_guardian(
        self,
        user: User,
        applicant_id: UUID,
        guardian_id: UUID,
        data: GuardianUpdate,
    ) -> Guardian:
        """Update guardian details, managing relationship and primary contact flags."""
        guardian = await self.get_guardian(user, applicant_id, guardian_id)

        applicant = await self._applicants.get_by_id(applicant_id)
        assert applicant is not None
        is_owner = applicant.owner_user_id == user.id
        can_override = user_has_permission(user, "application.override")
        if not is_owner and not can_override:
            raise PermissionDeniedException(
                "You do not have permission to modify this guardian.",
                code="PERMISSION_DENIED",
            )

        if data.relationship is not None and data.relationship != guardian.relationship:
            existing = await self._guardians.get_by_applicant_and_relationship(
                applicant_id, data.relationship
            )
            if existing is not None:
                raise ConflictException(
                    f"A guardian with relationship '{data.relationship}' "
                    "already exists for this child.",
                    code="GUARDIAN_RELATIONSHIP_EXISTS",
                )
            guardian.relationship = data.relationship

        if data.is_primary_contact is True:
            await self._guardians.clear_primary_contact(applicant_id, except_id=guardian.id)
            guardian.is_primary_contact = True
        elif data.is_primary_contact is False:
            guardian.is_primary_contact = False

        fields_to_update = data.model_dump(
            exclude_unset=True, exclude={"relationship", "is_primary_contact"}
        )
        for key, value in fields_to_update.items():
            setattr(guardian, key, value)

        return await self._guardians.update(guardian)

    async def delete_guardian(
        self, user: User, applicant_id: UUID, guardian_id: UUID
    ) -> None:
        """Delete guardian record."""
        guardian = await self.get_guardian(user, applicant_id, guardian_id)

        applicant = await self._applicants.get_by_id(applicant_id)
        assert applicant is not None
        is_owner = applicant.owner_user_id == user.id
        can_override = user_has_permission(user, "application.override")
        if not is_owner and not can_override:
            raise PermissionDeniedException(
                "You do not have permission to delete this guardian.",
                code="PERMISSION_DENIED",
            )

        await self._guardians.delete(guardian)
