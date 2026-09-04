# backend/apps/catalog/admin.py
#
# UPDATED —
# Original registrations unchanged; ProductImageInline and
# ProductVariantInline added to ProductAdmin, plus standalone admin for
# VariantAttribute/VariantAttributeValue (managed like Category — org-scoped
# lookup data, not something you'd only ever touch through a Product page).

from django.contrib import admin
from .models import (
    Category, UnitOfMeasure, Product, ProductBarcode,
    ProductImage, ProductVariant, VariantAttribute, VariantAttributeValue,
)


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


# --- NEW for e-commerce ---------------------------------------------------

class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ("image", "alt_text", "sort_order")


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ("sku", "barcode", "price_override", "is_active")
    # attribute_values (M2M) isn't editable inline by default in a
    # TabularInline without a through-model — manage those on the
    # ProductVariant's own admin page (registered below) instead.
    show_change_link = True


@admin.register(VariantAttribute)
class VariantAttributeAdmin(admin.ModelAdmin):
    list_display = ("name", "organization")
    list_filter = ("organization",)


@admin.register(VariantAttributeValue)
class VariantAttributeValueAdmin(admin.ModelAdmin):
    list_display = ("value", "attribute")
    list_filter = ("attribute",)


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("sku", "product", "price_override", "is_active")
    search_fields = ("sku", "barcode", "product__sku", "product__name")
    filter_horizontal = ("attribute_values",)


# --- Product, updated -------------------------------------------------------

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "sku", "name", "organization", "category", "selling_price",
        "is_active",
        # new:
        "product_type", "is_published_online",
    )
    list_filter = ("organization", "category",
                   "is_active", "is_published_online")
    search_fields = ("sku", "name")
    inlines = [ProductBarcodeInline, ProductImageInline, ProductVariantInline]
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ProductBarcode)
class ProductBarcodeAdmin(admin.ModelAdmin):
    list_display = ("barcode", "product", "unit",
                    "conversion_factor", "is_primary")
    search_fields = ("barcode", "product__sku", "product__name")
