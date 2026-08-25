# backend/apps/purchases/admin.py

from django.contrib import admin
from .models import Supplier, PurchaseOrder, PurchaseOrderItem


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "phone", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("name", "phone", "email")


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("reference_number", "supplier",
                    "branch", "status", "order_date")
    list_filter = ("status", "branch", "supplier")
    search_fields = ("reference_number",)
    inlines = [PurchaseOrderItemInline]
