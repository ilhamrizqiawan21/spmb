"""Tests for Applicant and Guardian CRUD, isolation, and primary contact rules (F5)."""

import pytest
from django.test import Client
from rest_framework import status

from apps.admission.models import Applicant, Guardian, GuardianRelationship
from apps.auth.models import Role, User, UserRole


@pytest.fixture
def parent_a(db: None) -> User:
    user = User.objects.create_user(
        name="Parent A",
        email="parenta@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_a_client(parent_a: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parenta@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def parent_b(db: None) -> User:
    user = User.objects.create_user(
        name="Parent B",
        email="parentb@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="parent")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def parent_b_client(parent_b: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "parentb@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.fixture
def admin_user(db: None) -> User:
    user = User.objects.create_user(
        name="Admin User",
        email="admin@example.test",
        password="ValidPassword123!",
    )
    role = Role.objects.get(code="admission_admin")
    UserRole.objects.create(user=user, role=role)
    return user


@pytest.fixture
def admin_client(admin_user: User) -> Client:
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "admin@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    return client


@pytest.mark.django_db
def test_applicant_crud_by_parent(parent_a_client: Client, parent_a: User) -> None:
    payload = {
        "full_name": "Child A",
        "gender": "MALE",
        "birth_place": "Jakarta",
        "birth_date": "2015-05-10",
        "address": "Jl. Merdeka No. 1",
        "nisn": "1234567890",
        "nik": "3171000000000001",
    }
    # 1. Create applicant
    res_create = parent_a_client.post(
        "/api/v1/admission/applicants", payload, content_type="application/json"
    )
    assert res_create.status_code == status.HTTP_201_CREATED
    applicant_data = res_create.json()
    assert applicant_data["full_name"] == "Child A"
    assert applicant_data["owner_user_id"] == str(parent_a.id)

    applicant_id = applicant_data["id"]

    # 2. List applicants
    res_list = parent_a_client.get("/api/v1/admission/applicants")
    assert res_list.status_code == status.HTTP_200_OK
    assert len(res_list.json()) == 1
    assert res_list.json()[0]["id"] == applicant_id

    # 3. Get detail
    res_detail = parent_a_client.get(f"/api/v1/admission/applicants/{applicant_id}")
    assert res_detail.status_code == status.HTTP_200_OK
    assert res_detail.json()["full_name"] == "Child A"

    # 4. Patch applicant
    patch_payload = {"full_name": "Child A Updated", "nickname": "Budi"}
    res_patch = parent_a_client.patch(
        f"/api/v1/admission/applicants/{applicant_id}",
        patch_payload,
        content_type="application/json",
    )
    assert res_patch.status_code == status.HTTP_200_OK
    assert res_patch.json()["full_name"] == "Child A Updated"
    assert res_patch.json()["nickname"] == "Budi"

    # 5. Delete applicant
    res_del = parent_a_client.delete(f"/api/v1/admission/applicants/{applicant_id}")
    assert res_del.status_code == status.HTTP_204_NO_CONTENT
    assert not Applicant.objects.filter(pk=applicant_id).exists()


@pytest.mark.django_db
def test_applicant_parent_isolation(
    parent_a_client: Client, parent_b_client: Client, parent_a: User
) -> None:
    # Parent A creates applicant
    payload = {
        "full_name": "Child A",
        "gender": "FEMALE",
        "birth_place": "Bandung",
        "birth_date": "2016-01-01",
        "address": "Jl. Asia Afrika",
    }
    res_create = parent_a_client.post(
        "/api/v1/admission/applicants", payload, content_type="application/json"
    )
    applicant_id = res_create.json()["id"]

    # Parent B lists applicants -> empty
    res_b_list = parent_b_client.get("/api/v1/admission/applicants")
    assert res_b_list.status_code == status.HTTP_200_OK
    assert len(res_b_list.json()) == 0

    # Parent B tries to access applicant A -> 403 Forbidden
    res_b_get = parent_b_client.get(f"/api/v1/admission/applicants/{applicant_id}")
    assert res_b_get.status_code == status.HTTP_403_FORBIDDEN

    # Parent B tries to edit applicant A -> 403 Forbidden
    res_b_patch = parent_b_client.patch(
        f"/api/v1/admission/applicants/{applicant_id}",
        {"full_name": "Hacked Name"},
        content_type="application/json",
    )
    assert res_b_patch.status_code == status.HTTP_403_FORBIDDEN

    # Parent B tries to delete applicant A -> 403 Forbidden
    res_b_del = parent_b_client.delete(f"/api/v1/admission/applicants/{applicant_id}")
    assert res_b_del.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_applicant_admin_override(
    parent_a_client: Client, admin_client: Client, parent_a: User
) -> None:
    # Parent A creates applicant
    payload = {
        "full_name": "Child A",
        "gender": "MALE",
        "birth_place": "Surabaya",
        "birth_date": "2015-08-20",
        "address": "Jl. Pemuda",
    }
    res_create = parent_a_client.post(
        "/api/v1/admission/applicants", payload, content_type="application/json"
    )
    applicant_id = res_create.json()["id"]

    # Admin can list all applicants
    res_admin_list = admin_client.get("/api/v1/admission/applicants")
    assert res_admin_list.status_code == status.HTTP_200_OK
    assert len(res_admin_list.json()) >= 1

    # Admin can update applicant
    res_admin_patch = admin_client.patch(
        f"/api/v1/admission/applicants/{applicant_id}",
        {"full_name": "Admin Corrected Name"},
        content_type="application/json",
    )
    assert res_admin_patch.status_code == status.HTTP_200_OK
    assert res_admin_patch.json()["full_name"] == "Admin Corrected Name"


@pytest.mark.django_db
def test_guardian_crud_and_primary_contact_rule(parent_a_client: Client, parent_a: User) -> None:
    # 1. Create applicant first
    app_payload = {
        "full_name": "Child A",
        "gender": "MALE",
        "birth_place": "Jakarta",
        "birth_date": "2015-05-10",
        "address": "Jl. Merdeka",
    }
    res_app = parent_a_client.post(
        "/api/v1/admission/applicants", app_payload, content_type="application/json"
    )
    applicant_id = res_app.json()["id"]

    # 2. Add Father as primary contact
    father_payload = {
        "relationship": GuardianRelationship.FATHER,
        "full_name": "Father A",
        "phone": "081234567890",
        "occupation": "Engineer",
        "is_primary_contact": True,
    }
    res_father = parent_a_client.post(
        f"/api/v1/admission/applicants/{applicant_id}/guardians",
        father_payload,
        content_type="application/json",
    )
    assert res_father.status_code == status.HTTP_201_CREATED
    father_id = res_father.json()["id"]
    assert res_father.json()["is_primary_contact"] is True

    # 3. Add Mother as primary contact -> Father should no longer be primary
    mother_payload = {
        "relationship": GuardianRelationship.MOTHER,
        "full_name": "Mother A",
        "phone": "089876543210",
        "occupation": "Doctor",
        "is_primary_contact": True,
    }
    res_mother = parent_a_client.post(
        f"/api/v1/admission/applicants/{applicant_id}/guardians",
        mother_payload,
        content_type="application/json",
    )
    assert res_mother.status_code == status.HTTP_201_CREATED
    mother_id = res_mother.json()["id"]
    assert res_mother.json()["is_primary_contact"] is True

    # Verify Father is no longer primary contact
    father_obj = Guardian.objects.get(pk=father_id)
    assert father_obj.is_primary_contact is False

    # 4. Duplicate relationship (adding second Father) -> 400 Bad Request
    res_dup = parent_a_client.post(
        f"/api/v1/admission/applicants/{applicant_id}/guardians",
        father_payload,
        content_type="application/json",
    )
    assert res_dup.status_code == status.HTTP_400_BAD_REQUEST

    # 5. List guardians
    res_g_list = parent_a_client.get(f"/api/v1/admission/applicants/{applicant_id}/guardians")
    assert res_g_list.status_code == status.HTTP_200_OK
    assert len(res_g_list.json()) == 2

    # 6. Delete Mother guardian
    res_g_del = parent_a_client.delete(
        f"/api/v1/admission/applicants/{applicant_id}/guardians/{mother_id}"
    )
    assert res_g_del.status_code == status.HTTP_204_NO_CONTENT
    assert not Guardian.objects.filter(pk=mother_id).exists()


@pytest.mark.django_db
def test_guardian_parent_isolation(
    parent_a_client: Client, parent_b_client: Client, parent_a: User
) -> None:
    app_payload = {
        "full_name": "Child A",
        "gender": "FEMALE",
        "birth_place": "Medan",
        "birth_date": "2016-03-15",
        "address": "Jl. Gatot Subroto",
    }
    res_app = parent_a_client.post(
        "/api/v1/admission/applicants", app_payload, content_type="application/json"
    )
    applicant_id = res_app.json()["id"]

    father_payload = {
        "relationship": GuardianRelationship.FATHER,
        "full_name": "Father A",
        "phone": "081234567890",
    }
    res_father = parent_a_client.post(
        f"/api/v1/admission/applicants/{applicant_id}/guardians",
        father_payload,
        content_type="application/json",
    )
    guardian_id = res_father.json()["id"]

    # Parent B attempts to access guardians of Parent A's child -> 403 Forbidden
    res_b_list = parent_b_client.get(f"/api/v1/admission/applicants/{applicant_id}/guardians")
    assert res_b_list.status_code == status.HTTP_403_FORBIDDEN

    res_b_get = parent_b_client.get(
        f"/api/v1/admission/applicants/{applicant_id}/guardians/{guardian_id}"
    )
    assert res_b_get.status_code == status.HTTP_403_FORBIDDEN
