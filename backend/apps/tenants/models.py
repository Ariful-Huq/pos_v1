# backend/apps/tenants/models.py

from django.db import models
from apps.core.models import BaseModel


class Organization(BaseModel):
    """The business/tenant itself. Even a single-branch shop gets one row here —
    this is what makes multi-branch support additive later, not a migration."""
    name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Branch(BaseModel):
    """A physical store location under an Organization."""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="branches"
    )
    name = models.CharField(max_length=200)
    # short code, e.g. "DHK-01"
    code = models.CharField(max_length=20, unique=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("organization", "code")

    def __str__(self):
        return f"{self.name} ({self.code})"


class Terminal(BaseModel):
    """A specific POS device/till within a branch. Sales are ultimately
    attributed to a terminal, not just a branch — useful for shift
    reconciliation and hardware-specific settings (default printer, etc.)."""
    branch = models.ForeignKey(
        Branch, on_delete=models.CASCADE, related_name="terminals"
    )
    name = models.CharField(max_length=100)          # e.g. "Counter 1"
    identifier = models.CharField(
        max_length=50, unique=True)  # device/install id
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("branch", "name")

    def __str__(self):
        return f"{self.branch.code} / {self.name}"
