"""Role model for RBAC."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.permission import Permission


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A named collection of permissions assignable to users."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=false(), default=False
    )

    permissions: Mapped[list["Permission"]] = relationship(  # noqa: F821
        "Permission",
        secondary="role_permissions",
        viewonly=True,
        order_by="Permission.code",
    )
