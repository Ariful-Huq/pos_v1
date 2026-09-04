# backend/apps/catalog/serializers.py
#
# UPDATED —
# Original content preserved as-is; new serializers and fields are additive,
# marked below.

from rest_framework import serializers
from apps.tenants.models import Organization
from .models import (
    Product, Category, UnitOfMeasure, ProductBarcode,
    ProductImage, ProductVariant, VariantAttribute, VariantAttributeValue,
)
from .defaults import CurrentOrganizationDefault


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = ["id", "code", "name"]


class CategorySerializer(serializers.ModelSerializer):
    # Category has no unique_together involving organization, so a plain
    # required=False + view-side perform_create() is enough here — unlike
    # Product below, which needs the HiddenField treatment.
    organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.all(), required=False
    )
    parent_name = serializers.CharField(
        source="parent.name", read_only=True, default=None)

    class Meta:
        model = Category
        fields = ["id", "organization", "name",
                  "parent", "parent_name", "is_active"]


class ProductBarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductBarcode
        fields = ["id", "barcode", "unit", "conversion_factor", "is_primary"]


# --- NEW FOR E-COMMERCE ---------------------------------------------------

class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "image", "alt_text", "sort_order"]


class VariantAttributeValueSerializer(serializers.ModelSerializer):
    attribute_name = serializers.CharField(
        source="attribute.name", read_only=True)

    class Meta:
        model = VariantAttributeValue
        fields = ["id", "attribute", "attribute_name", "value"]


class ProductVariantSerializer(serializers.ModelSerializer):
    attribute_values = VariantAttributeValueSerializer(
        many=True, read_only=True)
    attribute_value_ids = serializers.PrimaryKeyRelatedField(
        source="attribute_values", queryset=VariantAttributeValue.objects.all(),
        many=True, write_only=True, required=False,
    )
    effective_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True)
    # For display in the storefront's variant picker, e.g. "Large / Red"
    label = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id", "sku", "barcode", "price_override", "effective_price",
            "attribute_values", "attribute_value_ids", "is_active", "label",
        ]

    def get_label(self, obj):
        return " / ".join(v.value for v in obj.attribute_values.all())


# --- Product, updated ------------------------------------------------------

class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None)
    unit_code = serializers.CharField(source="base_unit.code", read_only=True)
    barcodes = ProductBarcodeSerializer(many=True, read_only=True)
    # MUST stay a HiddenField, not a plain optional field: Product has
    # unique_together = ("organization", "sku"), and DRF's
    # UniqueTogetherValidator force-requires every field in that
    # constraint regardless of the field's own required=False. A
    # HiddenField with a default is the only thing that's exempt.
    organization = serializers.HiddenField(
        default=CurrentOrganizationDefault())

    # --- NEW for e-commerce ---
    gallery_images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "organization", "sku", "name", "description", "image",
            "category", "category_name", "base_unit", "unit_code",
            "cost_price", "selling_price", "tax_rate", "is_active", "barcodes",
            # new:
            "product_type", "slug", "is_published_online", "gallery_images", "variants",
        ]


class ProductPublicSerializer(serializers.ModelSerializer):
    """Storefront-facing subset — no cost_price, no organization, no
    is_active/is_published_online (the queryset already filters on that).
    Use this in apps/ecommerce/views.py instead of ProductSerializer."""
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None)
    images = ProductImageSerializer(
        source="gallery_images", many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "slug", "sku", "name", "description", "image",
            "category", "category_name", "selling_price", "product_type",
            "images", "variants",
        ]
