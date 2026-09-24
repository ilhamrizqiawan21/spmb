"""Tests for Guardian CRUD, relationship uniqueness, primary contact logic, and RBAC."""

from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.core.session import SESSION_COOKIE_NAME, create_session
from app.models.guardian import Guardian
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


async def _create_test_applicant(client: AsyncClient, name: str = "Test Child") -> str:
    res = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": name,
            "gender": "MALE",
            "birth_place": "Jakarta",
            "birth_date": "2015-01-01",
            "address": "Jl. Merdeka No. 1",
        },
    )
    assert res.status_code == 201
    return str(res.json()["id"])


@pytest.mark.asyncio
async def test_create_guardians_as_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)

    # 1. Add Father
    father_payload = {
        "relationship": "FATHER",
        "full_name": "Budi Santoso",
        "nik": "3201010101010003",
        "phone": "081234567890",
        "email": "budi@example.com",
        "occupation": "Software Engineer",
        "education": "S1",
        "monthly_income": 15000000.0,
        "address": "Jl. Merdeka No. 10",
        "is_primary_contact": True,
    }
    father_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians", json=father_payload
    )
    assert father_res.status_code == 201
    father_data = father_res.json()
    assert father_data["relationship"] == "FATHER"
    assert father_data["full_name"] == "Budi Santoso"
    assert father_data["is_primary_contact"] is True
    assert father_data["applicant_id"] == applicant_id

    # 2. Add Mother
    mother_payload = {
        "relationship": "MOTHER",
        "full_name": "Siti Aminah",
        "phone": "081234567891",
        "is_primary_contact": False,
    }
    mother_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians", json=mother_payload
    )
    assert mother_res.status_code == 201
    assert mother_res.json()["relationship"] == "MOTHER"
    assert mother_res.json()["is_primary_contact"] is False

    # 3. List Guardians
    list_res = await client.get(f"/api/v1/applicants/{applicant_id}/guardians")
    assert list_res.status_code == 200
    guardians = list_res.json()
    assert len(guardians) == 2


@pytest.mark.asyncio
async def test_create_duplicate_relationship_rejected(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)

    payload = {
        "relationship": "FATHER",
        "full_name": "First Father",
        "is_primary_contact": True,
    }
    res1 = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians", json=payload
    )
    assert res1.status_code == 201

    duplicate_payload = {
        "relationship": "FATHER",
        "full_name": "Second Father",
        "is_primary_contact": False,
    }
    res2 = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians", json=duplicate_payload
    )
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "GUARDIAN_RELATIONSHIP_EXISTS"


@pytest.mark.asyncio
async def test_primary_contact_switching_on_create(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)

    # 1. Father created as primary
    father_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={
            "relationship": "FATHER",
            "full_name": "Father Name",
            "is_primary_contact": True,
        },
    )
    father_id = father_res.json()["id"]

    # 2. Mother created as primary
    mother_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={
            "relationship": "MOTHER",
            "full_name": "Mother Name",
            "is_primary_contact": True,
        },
    )
    mother_id = mother_res.json()["id"]
    assert mother_res.json()["is_primary_contact"] is True

    # 3. Verify Father is no longer primary
    get_father = await client.get(
        f"/api/v1/applicants/{applicant_id}/guardians/{father_id}"
    )
    assert get_father.status_code == 200
    assert get_father.json()["is_primary_contact"] is False

    # 4. Verify Mother is primary
    get_mother = await client.get(
        f"/api/v1/applicants/{applicant_id}/guardians/{mother_id}"
    )
    assert get_mother.status_code == 200
    assert get_mother.json()["is_primary_contact"] is True


@pytest.mark.asyncio
async def test_update_guardian_details_and_primary_switch(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)

    father_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={
            "relationship": "FATHER",
            "full_name": "Father Name",
            "is_primary_contact": True,
        },
    )
    father_id = father_res.json()["id"]

    mother_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={
            "relationship": "MOTHER",
            "full_name": "Mother Name",
            "is_primary_contact": False,
        },
    )
    mother_id = mother_res.json()["id"]

    # Update Mother to become primary contact and update phone
    patch_res = await client.patch(
        f"/api/v1/applicants/{applicant_id}/guardians/{mother_id}",
        json={
            "phone": "0899999999",
            "is_primary_contact": True,
        },
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["is_primary_contact"] is True
    assert patch_res.json()["phone"] == "0899999999"

    # Father must now have is_primary_contact = False
    get_father = await client.get(
        f"/api/v1/applicants/{applicant_id}/guardians/{father_id}"
    )
    assert get_father.json()["is_primary_contact"] is False


@pytest.mark.asyncio
async def test_update_guardian_relationship_conflict(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)

    await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "FATHER", "full_name": "Father"},
    )
    mother_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "MOTHER", "full_name": "Mother"},
    )
    mother_id = mother_res.json()["id"]

    # Attempt to change Mother's relationship to FATHER
    patch_res = await client.patch(
        f"/api/v1/applicants/{applicant_id}/guardians/{mother_id}",
        json={"relationship": "FATHER"},
    )
    assert patch_res.status_code == 409
    assert patch_res.json()["error"]["code"] == "GUARDIAN_RELATIONSHIP_EXISTS"


@pytest.mark.asyncio
async def test_guardian_denied_for_other_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Parent A creates applicant and guardian
    _, token_a = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_a)

    applicant_id = await _create_test_applicant(client)
    res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "FATHER", "full_name": "Father A"},
    )
    guardian_id = res.json()["id"]

    # Parent B attempts operations
    _, token_b = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_b)

    # 1. List
    list_res = await client.get(f"/api/v1/applicants/{applicant_id}/guardians")
    assert list_res.status_code == 403
    assert list_res.json()["error"]["code"] == "PERMISSION_DENIED"

    # 2. Get one
    get_res = await client.get(
        f"/api/v1/applicants/{applicant_id}/guardians/{guardian_id}"
    )
    assert get_res.status_code == 403

    # 3. Create
    create_res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "MOTHER", "full_name": "Attacker"},
    )
    assert create_res.status_code == 403

    # 4. Patch
    patch_res = await client.patch(
        f"/api/v1/applicants/{applicant_id}/guardians/{guardian_id}",
        json={"full_name": "Hacked"},
    )
    assert patch_res.status_code == 403

    # 5. Delete
    delete_res = await client.delete(
        f"/api/v1/applicants/{applicant_id}/guardians/{guardian_id}"
    )
    assert delete_res.status_code == 403


@pytest.mark.asyncio
async def test_guardian_allowed_for_staff(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, parent_token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, parent_token)

    applicant_id = await _create_test_applicant(client)
    res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "FATHER", "full_name": "Father"},
    )
    guardian_id = res.json()["id"]

    # Staff with application.read
    _, staff_token = await _create_user_with_role(db_session, "verifier")
    client.cookies.set(SESSION_COOKIE_NAME, staff_token)

    list_res = await client.get(f"/api/v1/applicants/{applicant_id}/guardians")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    get_res = await client.get(
        f"/api/v1/applicants/{applicant_id}/guardians/{guardian_id}"
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == guardian_id


@pytest.mark.asyncio
async def test_delete_guardian(client: AsyncClient, db_session: AsyncSession) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)
    res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "GUARDIAN", "full_name": "Uncle Bob"},
    )
    guardian_id = res.json()["id"]

    del_res = await client.delete(
        f"/api/v1/applicants/{applicant_id}/guardians/{guardian_id}"
    )
    assert del_res.status_code == 204

    get_res = await client.get(
        f"/api/v1/applicants/{applicant_id}/guardians/{guardian_id}"
    )
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_guardian_cascade_deletion_with_applicant(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    applicant_id = await _create_test_applicant(client)
    res = await client.post(
        f"/api/v1/applicants/{applicant_id}/guardians",
        json={"relationship": "FATHER", "full_name": "Father To Be Cascadedeleted"},
    )
    guardian_id = res.json()["id"]

    # Delete applicant
    del_res = await client.delete(f"/api/v1/applicants/{applicant_id}")
    assert del_res.status_code == 204

    # Query DB directly to verify guardian was cascade deleted
    db_result = await db_session.execute(
        select(Guardian).where(Guardian.id == guardian_id)
    )
    assert db_result.scalar_one_or_none() is None
