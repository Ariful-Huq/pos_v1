# backend/apps/staff/models.py

from django.conf import settings
from django.db import models
from apps.core.models import BaseModel


class StaffProfile(BaseModel):
    """Employee-specific profile data. Role and branch access are handled
    separately by authz.UserBranchRole — this model does NOT duplicate
    that. primary_branch here is just "home base" for scheduling/payroll
    context, not a permission boundary."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="staff_profile"
    )
    employee_id = models.CharField(max_length=30, unique=True)
    phone = models.CharField(max_length=30, blank=True)
    # free-text label, e.g. "Senior Cashier"
    designation = models.CharField(max_length=100, blank=True)
    primary_branch = models.ForeignKey(
        "tenants.Branch", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="staff_members"
    )
    date_joined = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.employee_id} — {self.user.get_full_name() or self.user.username}"
