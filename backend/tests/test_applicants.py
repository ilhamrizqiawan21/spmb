"""Tests for Applicant CRUD, ownership enforcement, and RBAC isolation."""

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
async def test_create_applicant_as_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    parent, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    payload = {
        "full_name": "Ahmad Dahlan",
        "nickname": "Dahlan",
        "gender": "MALE",
        "birth_place": "Yogyakarta",
        "birth_date": "2015-05-12",
        "nisn": "1234567890",
        "nik": "3201010101010001",
        "family_card_number": "3201010101010002",
        "address": "Jl. KHA Dahlan No. 1",
        "province": "DI Yogyakarta",
        "city": "Yogyakarta",
        "district": "Gondomanan",
        "village": "Ngupasan",
        "postal_code": "55122",
        "previous_school_name": "SD Muhammadiyah 1",
        "previous_school_npsn": "20400001",
        "previous_school_address": "Jl. Kauman No. 5",
    }
    response = await client.post("/api/v1/applicants", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["full_name"] == payload["full_name"]
    assert body["nickname"] == "Dahlan"
    assert body["gender"] == "MALE"
    assert body["birth_place"] == "Yogyakarta"
    assert body["birth_date"] == "2015-05-12"
    assert body["nisn"] == "1234567890"
    assert body["nik"] == "3201010101010001"
    assert body["family_card_number"] == "3201010101010002"
    assert body["address"] == "Jl. KHA Dahlan No. 1"
    assert body["province"] == "DI Yogyakarta"
    assert body["city"] == "Yogyakarta"
    assert body["district"] == "Gondomanan"
    assert body["village"] == "Ngupasan"
    assert body["postal_code"] == "55122"
    assert body["previous_school_name"] == "SD Muhammadiyah 1"
    assert body["previous_school_npsn"] == "20400001"
    assert body["previous_school_address"] == "Jl. Kauman No. 5"
    assert body["owner_user_id"] == str(parent.id)
    assert "id" in body


@pytest.mark.asyncio
async def test_create_applicant_denied_for_unauthenticated(
    client: AsyncClient,
) -> None:
    client.cookies.clear()
    payload = {
        "full_name": "Anonymous Kid",
        "gender": "FEMALE",
        "birth_place": "Bandung",
        "birth_date": "2016-01-01",
        "address": "Jl. Dipatiukur No. 10",
    }
    response = await client.post("/api/v1/applicants", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_applicant_as_owner(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    payload = {
        "full_name": "Fatimah Azzahra",
        "gender": "FEMALE",
        "birth_place": "Bandung",
        "birth_date": "2016-08-20",
        "address": "Jl. Buah Batu No. 20",
    }
    create_res = await client.post("/api/v1/applicants", json=payload)
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    get_res = await client.get(f"/api/v1/applicants/{applicant_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == applicant_id
    assert get_res.json()["full_name"] == "Fatimah Azzahra"


@pytest.mark.asyncio
async def test_get_applicant_denied_for_other_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Parent A creates an applicant
    _, token_a = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_a)

    payload = {
        "full_name": "Child A",
        "gender": "MALE",
        "birth_place": "Jakarta",
        "birth_date": "2015-01-01",
        "address": "Jl. Sudirman No. 1",
    }
    create_res = await client.post("/api/v1/applicants", json=payload)
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    # Parent B tries to access Child A
    _, token_b = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_b)

    get_res = await client.get(f"/api/v1/applicants/{applicant_id}")
    assert get_res.status_code == 403
    assert get_res.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_get_applicant_allowed_for_staff(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Parent creates applicant
    _, parent_token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, parent_token)

    payload = {
        "full_name": "Child A",
        "gender": "MALE",
        "birth_place": "Jakarta",
        "birth_date": "2015-01-01",
        "address": "Jl. Sudirman No. 1",
    }
    create_res = await client.post("/api/v1/applicants", json=payload)
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    # Staff with application.read (e.g. verifier) accesses it
    _, staff_token = await _create_user_with_role(db_session, "verifier")
    client.cookies.set(SESSION_COOKIE_NAME, staff_token)

    get_res = await client.get(f"/api/v1/applicants/{applicant_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == applicant_id


@pytest.mark.asyncio
async def test_list_applicants_isolation_for_parents(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Parent A creates 2 children
    _, token_a = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_a)

    for name in ["Child A1", "Child A2"]:
        res = await client.post(
            "/api/v1/applicants",
            json={
                "full_name": name,
                "gender": "MALE",
                "birth_place": "Jakarta",
                "birth_date": "2015-01-01",
                "address": "Jl. Salemba No. 10",
            },
        )
        assert res.status_code == 201

    # Parent B creates 1 child
    _, token_b = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_b)

    res = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "Child B1",
            "gender": "FEMALE",
            "birth_place": "Bandung",
            "birth_date": "2016-02-02",
            "address": "Jl. Asia Afrika No. 5",
        },
    )
    assert res.status_code == 201

    # Parent B lists children
    list_b_res = await client.get("/api/v1/applicants")
    assert list_b_res.status_code == 200
    list_b_data = list_b_res.json()
    assert list_b_data["meta"]["total"] == 1
    assert len(list_b_data["items"]) == 1
    assert list_b_data["items"][0]["full_name"] == "Child B1"

    # Parent A lists children
    client.cookies.set(SESSION_COOKIE_NAME, token_a)
    list_a_res = await client.get("/api/v1/applicants")
    assert list_a_res.status_code == 200
    list_a_data = list_a_res.json()
    assert list_a_data["meta"]["total"] == 2
    assert len(list_a_data["items"]) == 2
    names = {item["full_name"] for item in list_a_data["items"]}
    assert names == {"Child A1", "Child A2"}


@pytest.mark.asyncio
async def test_list_applicants_as_staff_with_search(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Parent A creates child "Ibrahim Pasha"
    _, token_a = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_a)
    res_a = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "Ibrahim Pasha",
            "gender": "MALE",
            "birth_place": "Bogor",
            "birth_date": "2015-03-03",
            "address": "Jl. Pajajaran No. 1",
        },
    )
    assert res_a.status_code == 201

    # Parent B creates child "Siti Maryam"
    _, token_b = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_b)
    res_b = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "Siti Maryam",
            "gender": "FEMALE",
            "birth_place": "Depok",
            "birth_date": "2016-04-04",
            "address": "Jl. Margonda No. 1",
        },
    )
    assert res_b.status_code == 201

    # Staff lists all
    _, staff_token = await _create_user_with_role(db_session, "verifier")
    client.cookies.set(SESSION_COOKIE_NAME, staff_token)

    list_all_res = await client.get("/api/v1/applicants")
    assert list_all_res.status_code == 200
    assert list_all_res.json()["meta"]["total"] == 2

    # Staff searches for Maryam
    search_res = await client.get("/api/v1/applicants?search=maryam")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["meta"]["total"] == 1
    assert search_data["items"][0]["full_name"] == "Siti Maryam"


@pytest.mark.asyncio
async def test_update_applicant_as_owner(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    create_res = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "Yusuf Mansur",
            "gender": "MALE",
            "birth_place": "Jakarta",
            "birth_date": "2015-01-01",
            "address": "Jl. Gatot Subroto No. 1",
        },
    )
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    patch_res = await client.patch(
        f"/api/v1/applicants/{applicant_id}",
        json={
            "previous_school_name": "SD IT Al-Fityan",
            "city": "Jakarta Selatan",
        },
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["previous_school_name"] == "SD IT Al-Fityan"
    assert updated_data["city"] == "Jakarta Selatan"
    assert updated_data["full_name"] == "Yusuf Mansur"


@pytest.mark.asyncio
async def test_update_applicant_denied_for_other_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Parent A creates
    _, token_a = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_a)
    create_res = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "Original Name",
            "gender": "MALE",
            "birth_place": "Jakarta",
            "birth_date": "2015-01-01",
            "address": "Jl. Rasuna Said No. 1",
        },
    )
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    # Parent B attempts to update
    _, token_b = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_b)

    patch_res = await client.patch(
        f"/api/v1/applicants/{applicant_id}",
        json={"full_name": "Hacked Name"},
    )
    assert patch_res.status_code == 403
    assert patch_res.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_delete_applicant_as_owner(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    create_res = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "To Be Deleted",
            "gender": "MALE",
            "birth_place": "Jakarta",
            "birth_date": "2015-01-01",
            "address": "Jl. Thamrin No. 1",
        },
    )
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    delete_res = await client.delete(f"/api/v1/applicants/{applicant_id}")
    assert delete_res.status_code == 204

    # Verification: should now return 404
    get_res = await client.get(f"/api/v1/applicants/{applicant_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_applicant_denied_for_other_parent(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token_a = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_a)

    create_res = await client.post(
        "/api/v1/applicants",
        json={
            "full_name": "Safe Child",
            "gender": "FEMALE",
            "birth_place": "Jakarta",
            "birth_date": "2015-01-01",
            "address": "Jl. Sabang No. 1",
        },
    )
    assert create_res.status_code == 201
    applicant_id = create_res.json()["id"]

    # Parent B tries to delete
    _, token_b = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token_b)

    delete_res = await client.delete(f"/api/v1/applicants/{applicant_id}")
    assert delete_res.status_code == 403
    assert delete_res.json()["error"]["code"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_applicant_not_found(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    _, token = await _create_user_with_role(db_session, "parent")
    client.cookies.set(SESSION_COOKIE_NAME, token)

    fake_id = uuid4()
    get_res = await client.get(f"/api/v1/applicants/{fake_id}")
    assert get_res.status_code == 404
    assert get_res.json()["error"]["code"] == "APPLICANT_NOT_FOUND"
