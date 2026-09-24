"""Tests for Authentication & RBAC (F3)."""

import pytest
from django.core.cache import cache
from django.test import Client
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.auth.models import Role, User, UserRole
from apps.auth.permissions import HasPermission


class DummyProtectedView(APIView):
    permission_classes = [IsAuthenticated, HasPermission("document.verify")]

    def get(self, request: Request) -> Response:
        return Response({"status": "verified_access_granted"})


@pytest.fixture(autouse=True)
def clear_rate_limit_cache() -> None:
    cache.clear()


@pytest.mark.django_db
def test_register_parent_with_email_success() -> None:
    client = Client()
    payload = {
        "name": "Budi Santoso",
        "email": "budi@example.test",
        "password": "StrongPassword123!",
    }
    response = client.post("/api/v1/auth/register", payload, content_type="application/json")
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Budi Santoso"
    assert data["email"] == "budi@example.test"
    assert "parent" in data["roles"]

    user = User.objects.get(email="budi@example.test")
    assert user.check_password("StrongPassword123!")


@pytest.mark.django_db
def test_register_parent_with_phone_success() -> None:
    client = Client()
    payload = {
        "name": "Siti Rahma",
        "phone": "081234567890",
        "password": "StrongPassword123!",
    }
    response = client.post("/api/v1/auth/register", payload, content_type="application/json")
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["phone"] == "081234567890"
    assert "parent" in data["roles"]


@pytest.mark.django_db
def test_register_duplicate_email_fails() -> None:
    client = Client()
    payload = {
        "name": "Parent 1",
        "email": "duplicate@example.test",
        "password": "StrongPassword123!",
    }
    response = client.post("/api/v1/auth/register", payload, content_type="application/json")
    assert response.status_code == status.HTTP_201_CREATED

    response2 = client.post("/api/v1/auth/register", payload, content_type="application/json")
    assert response2.status_code == status.HTTP_400_BAD_REQUEST
    assert "already registered" in str(response2.json())


@pytest.mark.django_db
def test_register_short_password_fails() -> None:
    client = Client()
    payload = {
        "name": "Parent 1",
        "email": "short@example.test",
        "password": "short",
    }
    response = client.post("/api/v1/auth/register", payload, content_type="application/json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_login_success_and_me() -> None:
    User.objects.create_user(
        name="Ahmad User",
        email="ahmad@example.test",
        password="ValidPassword123!",
    )
    client = Client()
    response = client.post(
        "/api/v1/auth/login",
        {"identifier": "ahmad@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "ahmad@example.test"
    assert "spmb_session" in response.cookies

    # Access /me with session cookie
    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == status.HTTP_200_OK
    assert me_response.json()["name"] == "Ahmad User"


@pytest.mark.django_db
def test_login_invalid_password_fails() -> None:
    User.objects.create_user(
        name="User A",
        email="user_a@example.test",
        password="ValidPassword123!",
    )
    client = Client()
    response = client.post(
        "/api/v1/auth/login",
        {"identifier": "user_a@example.test", "password": "WrongPassword"},
        content_type="application/json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_login_inactive_user_fails() -> None:
    user = User.objects.create_user(
        name="Inactive User",
        email="inactive@example.test",
        password="ValidPassword123!",
    )
    user.is_active = False
    user.save()

    client = Client()
    response = client.post(
        "/api/v1/auth/login",
        {"identifier": "inactive@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "inactive" in response.json()["error"]["message"].lower()


@pytest.mark.django_db
def test_login_rate_limiting() -> None:
    User.objects.create_user(
        name="Target User",
        email="target@example.test",
        password="ValidPassword123!",
    )
    client = Client()

    for _ in range(5):
        res = client.post(
            "/api/v1/auth/login",
            {"identifier": "target@example.test", "password": "WrongPassword"},
            content_type="application/json",
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    # 6th attempt should be blocked with 403 PermissionDenied
    blocked = client.post(
        "/api/v1/auth/login",
        {"identifier": "target@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    assert blocked.status_code == status.HTTP_403_FORBIDDEN
    assert "too many" in blocked.json()["error"]["message"].lower()


@pytest.mark.django_db
def test_logout() -> None:
    User.objects.create_user(
        name="Logout User",
        email="logout@example.test",
        password="ValidPassword123!",
    )
    client = Client()
    client.post(
        "/api/v1/auth/login",
        {"identifier": "logout@example.test", "password": "ValidPassword123!"},
        content_type="application/json",
    )
    # Logged in, /me works
    assert client.get("/api/v1/auth/me").status_code == status.HTTP_200_OK

    # Logout
    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == status.HTTP_204_NO_CONTENT

    # /me now requires authentication
    assert client.get("/api/v1/auth/me").status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_permission_guard_permitted_and_forbidden() -> None:
    verifier_user = User.objects.create_user(
        name="Verifier User",
        email="verifier@example.test",
        password="ValidPassword123!",
    )
    verifier_role = Role.objects.get(code="verifier")
    UserRole.objects.create(user=verifier_user, role=verifier_role)

    parent_user = User.objects.create_user(
        name="Parent User",
        email="parent@example.test",
        password="ValidPassword123!",
    )
    parent_role = Role.objects.get(code="parent")
    UserRole.objects.create(user=parent_user, role=parent_role)

    view = DummyProtectedView.as_view()
    from django.test import RequestFactory

    factory = RequestFactory()

    # Verifier holds application.verify -> permitted
    req_verifier = factory.get("/dummy")
    req_verifier.user = verifier_user
    res_verifier = view(req_verifier)
    assert res_verifier.status_code == status.HTTP_200_OK

    # Parent does not hold application.verify -> forbidden (403)
    req_parent = factory.get("/dummy")
    req_parent.user = parent_user
    res_parent = view(req_parent)
    assert res_parent.status_code == status.HTTP_403_FORBIDDEN
