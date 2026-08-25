# backend/apps/staff/admin.py

from django.contrib import admin
from .models import StaffProfile


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "user", "designation",
                    "primary_branch", "is_active")
    list_filter = ("primary_branch", "is_active")
    search_fields = ("employee_id", "user__username",
                     "user__first_name", "user__last_name")
