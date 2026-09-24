from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import PermissionDeniedException
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.permissions.dependencies import require_permission


def _register_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Budi Santoso",
        "email": f"{uuid4().hex}@example.com",
        "password": "correct-horse-battery",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_register_creates_user_with_default_parent_role(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=_register_payload())
    assert response.status_code == 201
    body = response.json()
    assert body["roles"] == ["parent"]
    assert body["permissions"] == []
    assert "password" not in body
    assert "password_hash" not in body


@pytest.mark.asyncio
async def test_register_requires_email_or_phone(client: AsyncClient) -> None:
    payload = _register_payload()
    payload.pop("email")
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_weak_password(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/register", json=_register_payload(password="short"))
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(client: AsyncClient) -> None:
    payload = _register_payload()
    first = await client.post("/api/v1/auth/register", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/register", json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "EMAIL_TAKEN"


@pytest.mark.asyncio
async def test_login_with_valid_credentials_sets_session_cookie(client: AsyncClient) -> None:
    payload = _register_payload()
    await client.post("/api/v1/auth/register", json=payload)

    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 200
    assert "spmb_session" in response.cookies

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == payload["email"]


@pytest.mark.asyncio
async def test_login_with_invalid_password_is_rejected(client: AsyncClient) -> None:
    payload = _register_payload()
    await client.post("/api/v1/auth/register", json=payload)

    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["email"], "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert "spmb_session" not in response.cookies


@pytest.mark.asyncio
async def test_login_with_unknown_identifier_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@example.com", "password": "whatever12345"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_inactive_account_cannot_login(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    payload = _register_payload()
    await client.post("/api/v1/auth/register", json=payload)

    result = await db_session.execute(
        User.__table__.update()
        .where(User.email == payload["email"])
        .values(is_active=False)
    )
    assert result.rowcount == 1
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["email"], "password": payload["password"]},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "ACCOUNT_INACTIVE"


@pytest.mark.asyncio
async def test_me_requires_authentication(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalidates_session(client: AsyncClient) -> None:
    payload = _register_payload()
    await client.post("/api/v1/auth/register", json=payload)
    await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["email"], "password": payload["password"]},
    )
    assert (await client.get("/api/v1/auth/me")).status_code == 200

    logout_response = await client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204

    assert (await client.get("/api/v1/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_login_is_throttled_after_repeated_failures(client: AsyncClient) -> None:
    payload = _register_payload()
    await client.post("/api/v1/auth/register", json=payload)

    for _ in range(5):
        response = await client.post(
            "/api/v1/auth/login",
            json={"identifier": payload["email"], "password": "wrong-password"},
        )
        assert response.status_code == 401

    throttled = await client.post(
        "/api/v1/auth/login",
        json={"identifier": payload["email"], "password": "wrong-password"},
    )
    assert throttled.status_code == 429


@pytest.mark.asyncio
async def test_require_permission_allows_user_with_granted_permission(
    db_session: AsyncSession,
) -> None:
    role = Role(name="Test Verifier", code=f"verifier-{uuid4().hex}")
    permission = Permission(code=f"document.verify.{uuid4().hex}", name="Verify Document")
    db_session.add_all([role, permission])
    await db_session.flush()
    db_session.add(RolePermission(role_id=role.id, permission_id=permission.id))

    user = User(
        name="Verifier User",
        email=f"{uuid4().hex}@example.com",
        password_hash="unused-hash",
    )
    db_session.add(user)
    await db_session.flush()
    from app.models.user_role import UserRole

    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    from app.repositories.user_repository import UserRepository

    reloaded = await UserRepository(db_session).get_by_id(user.id)
    assert reloaded is not None

    dependency = require_permission(permission.code)
    allowed_user = await dependency(reloaded)
    assert allowed_user.id == user.id


@pytest.mark.asyncio
async def test_require_permission_denies_user_without_permission(
    db_session: AsyncSession,
) -> None:
    user = User(
        name="No Permission User",
        email=f"{uuid4().hex}@example.com",
        password_hash="unused-hash",
    )
    db_session.add(user)
    await db_session.commit()

    from app.repositories.user_repository import UserRepository

    reloaded = await UserRepository(db_session).get_by_id(user.id)
    assert reloaded is not None

    dependency = require_permission("some.permission.that.does.not.exist")
    with pytest.raises(PermissionDeniedException):
        await dependency(reloaded)
