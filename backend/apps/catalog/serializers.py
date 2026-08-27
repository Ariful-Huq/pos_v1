# backend/apps/catalog/serializers.py

from rest_framework import serializers
from .models import Product, Category, UnitOfMeasure, ProductBarcode
from .defaults import CurrentOrganizationDefault


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = ["id", "code", "name"]


class CategorySerializer(serializers.ModelSerializer):
    # HiddenField: never supplied by the client, always resolved server-side.
    # See defaults.CurrentOrganizationDefault for why this must be a
    # HiddenField-with-default rather than a plain required=False field.
    organization = serializers.HiddenField(
        default=CurrentOrganizationDefault())

    class Meta:
        model = Category
        fields = ["id", "organization", "name", "parent", "is_active"]


class ProductBarcodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductBarcode
        fields = ["id", "barcode", "unit", "conversion_factor", "is_primary"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None)
    unit_code = serializers.CharField(source="base_unit.code", read_only=True)
    barcodes = ProductBarcodeSerializer(many=True, read_only=True)
    organization = serializers.HiddenField(
        default=CurrentOrganizationDefault())

    class Meta:
        model = Product
        fields = [
            "id", "organization", "sku", "name", "description",
            "category", "category_name", "base_unit", "unit_code",
            "cost_price", "selling_price", "tax_rate", "is_active", "barcodes",
        ]
