# backend/apps/notifications/admin.py

from django.contrib import admin
from .models import NotificationTemplate, NotificationLog


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ("code", "channel", "is_active")
    list_filter = ("channel", "is_active")
    search_fields = ("code",)


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ("recipient", "channel", "status", "branch", "sent_at")
    list_filter = ("channel", "status", "branch")
    search_fields = ("recipient", "message")
    readonly_fields = ("created_at", "updated_at")
