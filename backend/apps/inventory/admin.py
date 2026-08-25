# backend/apps/inventory/admin.py

from django.contrib import admin
from .models import StockMovement, StockLevel


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "branch", "movement_type",
                    "quantity", "created_at", "created_by")
    list_filter = ("movement_type", "branch")
    search_fields = ("product__sku", "product__name", "idempotency_key")
    # ledger rows are never edited via admin
    readonly_fields = [f.name for f in StockMovement._meta.fields]

    def has_change_permission(self, request, obj=None):
        return False  # enforce append-only even for staff using the admin

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(StockLevel)
class StockLevelAdmin(admin.ModelAdmin):
    list_display = ("product", "branch", "quantity")
    list_filter = ("branch",)
    search_fields = ("product__sku", "product__name")

    def has_add_permission(self, request):
        return False  # StockLevel is derived, never manually created

    def has_change_permission(self, request, obj=None):
        return False  # never manually edited — use recalculate_stock_level() if it drifts
