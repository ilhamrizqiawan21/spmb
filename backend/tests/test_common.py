"""Tests for base models, soft delete, storage abstractions, and Celery setup."""

import uuid
from collections.abc import Generator
from pathlib import Path

import pytest
from django.db import connection, models

from apps.common.models import BaseModel, SoftDeleteModel
from apps.common.storage import LocalStorageAdapter
from config.celery import app as celery_app


# Concrete test model for testing base model and soft delete behaviors
class ExampleItem(BaseModel, SoftDeleteModel):
    name = models.CharField(max_length=100)

    class Meta:
        app_label = "common"
        db_table = "test_example_items"


@pytest.fixture
def example_table(db: None) -> Generator[None, None, None]:
    """Create test table for ExampleItem in test database."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS test_example_items (
                id uuid NOT NULL PRIMARY KEY,
                created_at timestamp with time zone NOT NULL,
                updated_at timestamp with time zone NOT NULL,
                deleted_at timestamp with time zone NULL,
                name varchar(100) NOT NULL
            );
            TRUNCATE TABLE test_example_items;
            """
        )
    yield
    with connection.cursor() as cursor:
        cursor.execute("TRUNCATE TABLE test_example_items;")


@pytest.mark.django_db
def test_base_model_uuid_and_timestamps(example_table: None) -> None:
    item = ExampleItem.objects.create(name="Item 1")

    assert isinstance(item.id, uuid.UUID)
    assert item.created_at is not None
    assert item.updated_at is not None
    assert item.deleted_at is None
    assert not item.is_deleted


@pytest.mark.django_db
def test_soft_delete_lifecycle(example_table: None) -> None:
    item = ExampleItem.objects.create(name="To be deleted")
    item_id = item.id

    # Normal soft delete
    item.delete()
    assert item.is_deleted
    assert item.deleted_at is not None

    # Excluded from default manager
    assert ExampleItem.objects.filter(id=item_id).count() == 0
    # Included in all_objects manager
    assert ExampleItem.all_objects.filter(id=item_id).count() == 1
    assert ExampleItem.all_objects.dead().filter(id=item_id).count() == 1

    # Restore
    item.restore()
    assert not item.is_deleted
    assert item.deleted_at is None
    assert ExampleItem.objects.filter(id=item_id).count() == 1

    # Hard delete
    item.hard_delete()
    assert ExampleItem.all_objects.filter(id=item_id).count() == 0


@pytest.mark.django_db
def test_soft_delete_queryset(example_table: None) -> None:
    ExampleItem.objects.create(name="Batch 1")
    ExampleItem.objects.create(name="Batch 2")

    ExampleItem.objects.filter(name__startswith="Batch").delete()

    assert ExampleItem.objects.count() == 0
    assert ExampleItem.all_objects.count() == 2

    # QuerySet hard delete
    ExampleItem.all_objects.hard_delete()
    assert ExampleItem.all_objects.count() == 0


def test_storage_adapter_put_and_open(tmp_path: Path) -> None:
    storage = LocalStorageAdapter(root=tmp_path)
    data = b"confidential applicant document content"

    key = storage.put(data)
    assert storage.exists(key)

    with storage.open(key) as stream:
        content = stream.read()
        assert content == data


def test_storage_adapter_key_validation(tmp_path: Path) -> None:
    storage = LocalStorageAdapter(root=tmp_path)

    with pytest.raises(ValueError, match="Invalid storage key"):
        storage._path("not-a-uuid")

    with pytest.raises(ValueError, match="Invalid storage key"):
        storage._path("../secret.txt")


def test_storage_signed_url_lifecycle(tmp_path: Path) -> None:
    storage = LocalStorageAdapter(root=tmp_path)
    key = storage.put(b"secure document")

    url = storage.generate_signed_url(key, expires_in=3600)
    assert "/documents/download?token=" in url

    token = url.split("token=")[1]
    verified_key = storage.verify_signed_token(token, max_age=3600)
    assert verified_key == key

    # Test tampering
    with pytest.raises(PermissionError, match="Invalid download signature"):
        storage.verify_signed_token(token + "tampered", max_age=3600)


def test_celery_configuration() -> None:
    assert celery_app.main == "spmb"
    assert celery_app.conf.task_serializer == "json"
