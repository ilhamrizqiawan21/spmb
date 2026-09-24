"""Reusable abstract base models for SPMB Terpadu."""

from __future__ import annotations

import uuid
from typing import Any

from django.db import models
from django.utils import timezone


class UUIDPrimaryKeyModel(models.Model):
    """Abstract base model providing a UUID primary key for business tables."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimestampedModel(models.Model):
    """Abstract base model providing timezone-aware created_at and updated_at."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet supporting soft delete operations."""

    def delete(self) -> tuple[int, dict[str, int]]:
        now = timezone.now()
        updated_count = self.update(deleted_at=now)
        return updated_count, {self.model._meta.label: updated_count}

    def hard_delete(self) -> tuple[int, dict[str, int]]:
        return super().delete()

    def alive(self) -> SoftDeleteQuerySet:
        return self.filter(deleted_at__isnull=True)

    def dead(self) -> SoftDeleteQuerySet:
        return self.filter(deleted_at__isnull=False)


class _BaseSoftDeleteManager(models.Manager.from_queryset(SoftDeleteQuerySet)):  # type: ignore[misc]
    pass


class SoftDeleteManager(_BaseSoftDeleteManager):
    """Default manager filtering out soft-deleted records."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset().alive()


class SoftDeleteAllManager(_BaseSoftDeleteManager):
    """Manager providing access to all records including soft-deleted ones."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return super().get_queryset()


class SoftDeleteModel(models.Model):
    """Abstract model supporting soft-delete strategy."""

    deleted_at = models.DateTimeField(null=True, blank=True, default=None)

    objects = SoftDeleteManager()
    all_objects = SoftDeleteAllManager()

    class Meta:
        abstract = True

    def delete(self, using: Any = None, keep_parents: bool = False) -> tuple[int, dict[str, int]]:
        self.deleted_at = timezone.now()
        update_fields = ["deleted_at"]
        if hasattr(self, "updated_at"):
            update_fields.append("updated_at")
        self.save(update_fields=update_fields)
        return 1, {self._meta.label: 1}

    def hard_delete(
        self, using: Any = None, keep_parents: bool = False
    ) -> tuple[int, dict[str, int]]:
        return super().delete(using=using, keep_parents=keep_parents)

    def restore(self) -> None:
        self.deleted_at = None
        update_fields = ["deleted_at"]
        if hasattr(self, "updated_at"):
            update_fields.append("updated_at")
        self.save(update_fields=update_fields)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class BaseModel(UUIDPrimaryKeyModel, TimestampedModel):
    """Standard base model with UUID primary key and timezone-aware timestamps."""

    class Meta:
        abstract = True
