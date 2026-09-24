"""Tests for Admission Period CRUD, validations, settings JSONB, and RBAC."""

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


async def _create_test_academic_year(
    client: AsyncClient, name_prefix: str = "AY"
) -> str:
    res = await client.post(
        "/api/v1/academic-years",
        json={
            "name": f"{name_prefix}-{uuid4().hex[:6]}",
            "start_date": "2026-07-01",
            "end_date": "2027-06-30",
            "is_active": True,
        },
    )
    assert res.status_code == 201
    return str(res.json()["id"])


@pytest.mark.asyncio
async def test_create_admission_period_as_admin(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    ay_id = await _create_test_academic_year(client)

    payload = {
        "academic_year_id": ay_id,
        "name": "Gelombang 1 Reguler",
        "code": f"GEL1-{uuid4().hex[:6]}",
        "registration_start": "2026-08-01T08:00:00Z",
        "registration_end": "2026-08-31T23:59:59Z",
        "announcement_at": "2026-09-05T10:00:00Z",
        "quota": 100,
        "is_active": True,
        "settings": {"allow_cash_payment": True, "early_bird_discount": 50000},
    }
    response = await client.post("/api/v1/admission-periods", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == payload["name"]
    assert body["code"] == payload["code"]
    assert body["quota"] == 100
    assert body["settings"]["early_bird_discount"] == 50000
    assert "id" in body


@pytest.mark.asyncio
async def test_create_admission_period_denied_for_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Create AY as admin first
    _, admin_token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, admin_token)
    ay_id = await _create_test_academic_year(client)

    # Switch to parent
    _, parent_token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, parent_token)

    payload = {
        "academic_year_id": ay_id,
        "name": "Gelombang 1",
        "code": "GEL1-FAIL",
        "registration_start": "2026-08-01T08:00:00Z",
        "registration_end": "2026-08-31T23:59:59Z",
    }
    response = await client.post("/api/v1/admission-periods", json=payload)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_create_admission_period_validates_dates(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    ay_id = await _create_test_academic_year(client)

    # Invalid: start >= end
    payload = {
        "academic_year_id": ay_id,
        "name": "Invalid Dates",
        "code": "INV-DATE",
        "registration_start": "2026-08-31T08:00:00Z",
        "registration_end": "2026-08-01T23:59:59Z",
    }
    response = await client.post("/api/v1/admission-periods", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_admission_period_validates_announcement_date(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    ay_id = await _create_test_academic_year(client)

    # Invalid: announcement earlier than registration end
    payload = {
        "academic_year_id": ay_id,
        "name": "Early Announcement",
        "code": "EARLY-ANN",
        "registration_start": "2026-08-01T08:00:00Z",
        "registration_end": "2026-08-31T23:59:59Z",
        "announcement_at": "2026-08-15T00:00:00Z",
    }
    response = await client.post("/api/v1/admission-periods", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_admission_period_validates_quota(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    ay_id = await _create_test_academic_year(client)

    # Invalid: negative quota
    payload = {
        "academic_year_id": ay_id,
        "name": "Negative Quota",
        "code": "NEG-QUOTA",
        "registration_start": "2026-08-01T08:00:00Z",
        "registration_end": "2026-08-31T23:59:59Z",
        "quota": -5,
    }
    response = await client.post("/api/v1/admission-periods", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_admission_period_rejects_duplicate_code_in_same_year(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    ay_id = await _create_test_academic_year(client)
    code = f"CODE-{uuid4().hex[:6]}"

    payload = {
        "academic_year_id": ay_id,
        "name": "Gelombang 1",
        "code": code,
        "registration_start": "2026-08-01T08:00:00Z",
        "registration_end": "2026-08-31T23:59:59Z",
    }
    res1 = await client.post("/api/v1/admission-periods", json=payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/admission-periods", json=payload)
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "ADMISSION_PERIOD_CODE_TAKEN"


@pytest.mark.asyncio
async def test_list_and_update_admission_periods(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "admission_admin")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    ay_id = await _create_test_academic_year(client)

    create_res = await client.post(
        "/api/v1/admission-periods",
        json={
            "academic_year_id": ay_id,
            "name": "Gelombang Khusus",
            "code": f"KHUSUS-{uuid4().hex[:6]}",
            "registration_start": "2026-09-01T00:00:00Z",
            "registration_end": "2026-09-15T23:59:59Z",
            "quota": 30,
        },
    )
    period_id = create_res.json()["id"]

    # List filtered by academic_year_id
    list_res = await client.get(f"/api/v1/admission-periods?academic_year_id={ay_id}")
    assert list_res.status_code == 200
    assert any(p["id"] == period_id for p in list_res.json()["items"])

    # Update quota and name
    patch_res = await client.patch(
        f"/api/v1/admission-periods/{period_id}",
        json={"quota": 45, "name": "Gelombang Khusus (Updated)"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["quota"] == 45
    assert patch_res.json()["name"] == "Gelombang Khusus (Updated)"

    # Delete
    del_res = await client.delete(f"/api/v1/admission-periods/{period_id}")
    assert del_res.status_code == 204

    # Confirm 404 after delete
    get_res = await client.get(f"/api/v1/admission-periods/{period_id}")
    assert get_res.status_code == 404
