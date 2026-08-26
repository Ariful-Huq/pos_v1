# backend/apps/sales/admin.py

from django.contrib import admin
from .models import (
    Customer,
    BranchSaleSequence,
    Sale,
    SaleItem,
    Payment,
    SaleReturn,
    SaleReturnItem,
)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "organization",
                    "loyalty_points", "is_active")
    list_filter = ("organization", "is_active")
    search_fields = ("name", "phone")


@admin.register(BranchSaleSequence)
class BranchSaleSequenceAdmin(admin.ModelAdmin):
    list_display = ("branch", "last_number")
    # Never manually edited — it's maintained only by services.generate_sale_number()

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("product", "quantity", "unit_price",
                       "discount_amount", "tax_amount", "line_total", "quantity_returned")
    can_delete = False


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("method", "amount", "reference", "received_at")
    can_delete = False


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("sale_number", "branch", "customer",
                    "status", "total_amount", "sold_at")
    list_filter = ("status", "branch")
    search_fields = ("sale_number",)
    inlines = [SaleItemInline, PaymentInline]
    readonly_fields = ("sale_number", "sold_at", "voided_at")

    def has_delete_permission(self, request, obj=None):
        return False  # sales are voided via services.void_sale(), never deleted


@admin.register(SaleReturn)
class SaleReturnAdmin(admin.ModelAdmin):
    list_display = ("sale", "refund_amount", "processed_by", "created_at")
    search_fields = ("sale__sale_number",)


admin.site.register(SaleReturnItem)
