"""Tests for Academic Year CRUD, single-active rule, and RBAC enforcement."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.session import SESSION_COOKIE_NAME, create_session
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole


async def _create_user_with_role(
    db_session: AsyncSession, role_code: str
) -> tuple[User, str]:
    result = await db_session.execute(select(Role).where(Role.code == role_code))
    role = result.scalar_one()

    user = User(
        name=f"User {role_code}",
        email=f"{uuid4().hex}@example.com",
        password_hash=hash_password("password123"),
    )
    db_session.add(user)
    await db_session.flush()

    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    token = await create_session(user.id)
    return user, token


@pytest.mark.asyncio
async def test_create_academic_year_as_admin(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    payload = {
        "name": f"AY-{uuid4().hex[:6]}",
        "start_date": "2026-07-01",
        "end_date": "2027-06-30",
        "is_active": True,
    }
    response = await client.post("/api/v1/academic-years", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]
    assert body["start_date"] == payload["start_date"]
    assert body["end_date"] == payload["end_date"]
    assert body["is_active"] is True
    assert "id" in body


@pytest.mark.asyncio
async def test_create_academic_year_denied_for_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    payload = {
        "name": f"AY-{uuid4().hex[:6]}",
        "start_date": "2026-07-01",
        "end_date": "2027-06-30",
    }
    response = await client.post("/api/v1/academic-years", json=payload)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_create_academic_year_denied_for_unauthenticated(
    client: AsyncClient,
) -> None:
    client.cookies.clear()
    payload = {
        "name": f"AY-{uuid4().hex[:6]}",
        "start_date": "2026-07-01",
        "end_date": "2027-06-30",
    }
    response = await client.post("/api/v1/academic-years", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_academic_year_validates_dates(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    # Invalid: start_date >= end_date
    payload = {
        "name": f"AY-{uuid4().hex[:6]}",
        "start_date": "2027-07-01",
        "end_date": "2026-06-30",
    }
    response = await client.post("/api/v1/academic-years", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_academic_year_rejects_duplicate_name(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    name = f"AY-DUPL-{uuid4().hex[:6]}"
    payload = {
        "name": name,
        "start_date": "2026-07-01",
        "end_date": "2027-06-30",
    }
    first = await client.post("/api/v1/academic-years", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/academic-years", json=payload)
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ACADEMIC_YEAR_NAME_TAKEN"


@pytest.mark.asyncio
async def test_single_active_academic_year_rule(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    first_payload = {
        "name": f"AY-1-{uuid4().hex[:6]}",
        "start_date": "2025-07-01",
        "end_date": "2026-06-30",
        "is_active": True,
    }
    res1 = await client.post("/api/v1/academic-years", json=first_payload)
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    second_payload = {
        "name": f"AY-2-{uuid4().hex[:6]}",
        "start_date": "2026-07-01",
        "end_date": "2027-06-30",
        "is_active": True,
    }
    res2 = await client.post("/api/v1/academic-years", json=second_payload)
    assert res2.status_code == 201
    id2 = res2.json()["id"]

    # Verify first academic year is now inactive, and second is active
    get1 = await client.get(f"/api/v1/academic-years/{id1}")
    assert get1.status_code == 200
    assert get1.json()["is_active"] is False

    get2 = await client.get(f"/api/v1/academic-years/{id2}")
    assert get2.status_code == 200
    assert get2.json()["is_active"] is True

    # Active endpoint returns the second one
    active_res = await client.get("/api/v1/academic-years/active")
    assert active_res.status_code == 200
    assert active_res.json()["id"] == id2


@pytest.mark.asyncio
async def test_list_and_update_academic_years(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    name = f"AY-UPD-{uuid4().hex[:6]}"
    res = await client.post(
        "/api/v1/academic-years",
        json={"name": name, "start_date": "2028-07-01", "end_date": "2029-06-30"},
    )
    ay_id = res.json()["id"]

    # List
    list_res = await client.get("/api/v1/academic-years?page=1&limit=10")
    assert list_res.status_code == 200
    items = list_res.json()["items"]
    assert any(item["id"] == ay_id for item in items)

    # Update
    updated_name = f"{name}-EDITED"
    update_res = await client.patch(
        f"/api/v1/academic-years/{ay_id}",
        json={"name": updated_name, "is_active": True},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == updated_name
    assert update_res.json()["is_active"] is True


@pytest.mark.asyncio
async def test_delete_academic_year_blocked_if_periods_exist(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    # 1. Create academic year
    ay_res = await client.post(
        "/api/v1/academic-years",
        json={
            "name": f"AY-DEL-{uuid4().hex[:6]}",
            "start_date": "2029-07-01",
            "end_date": "2030-06-30",
        },
    )
    ay_id = ay_res.json()["id"]

    # 2. Add an admission period to it
    p_res = await client.post(
        "/api/v1/admission-periods",
        json={
            "academic_year_id": ay_id,
            "name": "Gelombang 1",
            "code": "GEL1-2029",
            "registration_start": "2029-08-01T00:00:00Z",
            "registration_end": "2029-08-31T23:59:59Z",
        },
    )
    assert p_res.status_code == 201

    # 3. Attempt to delete academic year -> must be blocked (409)
    del_res = await client.delete(f"/api/v1/academic-years/{ay_id}")
    assert del_res.status_code == 409
    assert del_res.json()["error"]["code"] == "ACADEMIC_YEAR_HAS_PERIODS"

    # 4. Delete the period first
    period_id = p_res.json()["id"]
    del_p_res = await client.delete(f"/api/v1/admission-periods/{period_id}")
    assert del_p_res.status_code == 204

    # 5. Now delete the academic year -> succeeds (204)
    del_ay_res = await client.delete(f"/api/v1/academic-years/{ay_id}")
    assert del_ay_res.status_code == 204
