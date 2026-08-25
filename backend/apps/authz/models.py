# backend/apps/authz/models.py

from django.db import models
from django.conf import settings


class Feature(models.Model):
    # e.g. "sales.create"
    code = models.CharField(max_length=100, unique=True)
    module = models.CharField(max_length=50)
    label = models.CharField(max_length=150)


class Role(models.Model):
    # e.g. "branch_manager"
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    is_system = models.BooleanField(default=False)


class RoleFeature(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    feature = models.ForeignKey(Feature, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("role", "feature")


class Menu(models.Model):
    code = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=150)
    icon = models.CharField(max_length=50, blank=True)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE)
    order = models.PositiveIntegerField(default=0)
    required_feature = models.ForeignKey(Feature, on_delete=models.PROTECT)


class UserBranchRole(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             on_delete=models.CASCADE)
    branch = models.ForeignKey(
        "tenants.Branch", null=True, blank=True, on_delete=models.CASCADE)
    role = models.ForeignKey(Role, on_delete=models.PROTECT)

    class Meta:
        unique_together = ("user", "branch", "role")
