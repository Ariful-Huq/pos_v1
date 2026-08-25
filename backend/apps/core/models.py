# backend/apps/core/models.py

import uuid
from django.db import models


class TimeStampedModel(models.Model):
    """Adds created_at/updated_at to any model that inherits it."""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class UUIDModel(models.Model):
    """UUID primary key instead of an auto-incrementing integer.

    Matters for offline sync: a branch terminal creating a Sale while
    offline needs to generate a globally-unique ID locally, before it
    has ever talked to the server. Auto-increment IDs can't do that
    safely across multiple terminals/branches.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class BaseModel(UUIDModel, TimeStampedModel):
    """Standard base for most domain models across the project.
    Use this instead of models.Model directly unless a model has a
    specific reason not to need timestamps or a UUID pk."""

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Optional mixin for models that should be archived, not hard-deleted —
    relevant for things like Product, Staff, Branch where historical sales
    or reports still need to reference a row after it's been 'removed'."""
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True
