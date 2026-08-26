# backend/apps/accounting/admin.py

from django.contrib import admin
from .models import Account, JournalEntry, JournalEntryLine


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "account_type",
                    "organization", "is_active")
    list_filter = ("organization", "account_type", "is_active")
    search_fields = ("code", "name")


class JournalEntryLineInline(admin.TabularInline):
    model = JournalEntryLine
    extra = 0
    readonly_fields = ("account", "debit", "credit")
    can_delete = False


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "branch", "entry_date",
                    "description", "reference_type")
    list_filter = ("branch", "reference_type")
    search_fields = ("description", "idempotency_key")
    date_hierarchy = "entry_date"
    inlines = [JournalEntryLineInline]
    readonly_fields = ("idempotency_key",)

    def has_change_permission(self, request, obj=None):
        return False  # ledger entries are immutable once posted

    def has_delete_permission(self, request, obj=None):
        return False
