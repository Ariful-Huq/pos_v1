# backend/apps/inventory/serializers.py

from rest_framework import serializers
from .models import StockLevel, StockMovement


class StockLevelSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    branch_code = serializers.CharField(source="branch.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = StockLevel
        fields = [
            "id", "product", "product_sku", "product_name",
            "branch", "branch_code", "branch_name", "quantity",
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None)

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_sku", "branch", "movement_type", "quantity",
            "reference_type", "reference_id", "notes", "created_at", "created_by_username",
        ]
