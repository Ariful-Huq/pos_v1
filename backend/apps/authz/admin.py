# backend/apps/authz/admin.py

from django.contrib import admin
from .models import Feature, Role, RoleFeature, Menu, UserBranchRole


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("code", "module", "label")
    list_filter = ("module",)
    search_fields = ("code", "label")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_system")
    search_fields = ("code", "name")


@admin.register(RoleFeature)
class RoleFeatureAdmin(admin.ModelAdmin):
    list_display = ("role", "feature")
    list_filter = ("role",)


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = ("code", "label", "parent", "order", "required_feature")
    list_filter = ("parent",)


@admin.register(UserBranchRole)
class UserBranchRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "branch", "role")
    list_filter = ("branch", "role")
