# backend/apps/catalog/admin.py

from django.contrib import admin
from .models import Category, UnitOfMeasure, Product, ProductBarcode


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "parent", "is_active")
    list_filter = ("organization", "is_active")


@admin.register(UnitOfMeasure)
class UnitOfMeasureAdmin(admin.ModelAdmin):
    list_display = ("code", "name")


class ProductBarcodeInline(admin.TabularInline):
    model = ProductBarcode
    extra = 1


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "organization",
                    "category", "selling_price", "is_active")
    list_filter = ("organization", "category", "is_active")
    search_fields = ("sku", "name")
    inlines = [ProductBarcodeInline]


@admin.register(ProductBarcode)
class ProductBarcodeAdmin(admin.ModelAdmin):
    list_display = ("barcode", "product", "unit",
                    "conversion_factor", "is_primary")
    search_fields = ("barcode", "product__sku", "product__name")
