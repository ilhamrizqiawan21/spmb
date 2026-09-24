import pytest
from django.test import Client


@pytest.mark.django_db
def test_health_check() -> None:
    response = Client().get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "app" in data
    assert "version" in data
    assert "environment" in data


@pytest.mark.django_db
def test_readiness_check() -> None:
    response = Client().get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "ok"
    assert data["redis"] == "ok"
