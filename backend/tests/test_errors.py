import pytest
from httpx import AsyncClient
from fastapi import APIRouter
from app.core.errors import DomainException, PermissionDeniedException, NotFoundException
from app.main import app

error_test_router = APIRouter()


@error_test_router.get("/test-domain-error")
async def trigger_domain_error():
    raise DomainException(message="Invalid state transition", code="INVALID_TRANSITION")


@error_test_router.get("/test-permission-error")
async def trigger_permission_error():
    raise PermissionDeniedException(message="Action forbidden", code="FORBIDDEN")


@error_test_router.get("/test-not-found-error")
async def trigger_not_found_error():
    raise NotFoundException(message="Application not found", code="APPLICATION_NOT_FOUND")


@error_test_router.get("/test-generic-error")
async def trigger_generic_error():
    raise RuntimeError("Unexpected internal crash")


app.include_router(error_test_router, prefix="/api/v1/test-errors")


@pytest.mark.asyncio
async def test_domain_exception_handling(client: AsyncClient) -> None:
    response = await client.get("/api/v1/test-errors/test-domain-error")
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INVALID_TRANSITION"
    assert data["error"]["message"] == "Invalid state transition"


@pytest.mark.asyncio
async def test_permission_exception_handling(client: AsyncClient) -> None:
    response = await client.get("/api/v1/test-errors/test-permission-error")
    assert response.status_code == 403
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_not_found_exception_handling(client: AsyncClient) -> None:
    response = await client.get("/api/v1/test-errors/test-not-found-error")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "APPLICATION_NOT_FOUND"


@pytest.mark.asyncio
async def test_404_routing(client: AsyncClient) -> None:
    response = await client.get("/api/v1/non-existent-route")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_generic_500_handling(client: AsyncClient) -> None:
    response = await client.get("/api/v1/test-errors/test-generic-error")
    assert response.status_code == 500
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "INTERNAL_SERVER_ERROR"
