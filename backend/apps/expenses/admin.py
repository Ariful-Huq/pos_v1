# backend/apps/expenses/admin.py

from django.contrib import admin
from .models import ExpenseCategory, Expense


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("name",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("category", "branch", "amount",
                    "expense_date", "payment_method")
    list_filter = ("branch", "category", "payment_method")
    search_fields = ("description", "receipt_reference")
    date_hierarchy = "expense_date"
