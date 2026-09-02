# backend/apps/sales/serializers.py

from rest_framework import serializers
from .models import Sale, SaleItem, Payment, Customer


class SaleItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    # Needed by the POS cart UI to know whether a line item is a whole-count
    # unit (pcs — steps by 1, no decimals) or a measured unit (gm/ml/kg/l —
    # 2 decimals, digit-position stepping). Mirrors ProductSerializer's
    # unit_code field so the frontend can treat both consistently.
    unit_code = serializers.CharField(
        source="product.base_unit.code", read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            "id", "product", "product_sku", "product_name", "unit_code",
            "quantity", "unit_price", "discount_amount", "tax_amount",
            "line_total", "quantity_returned",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "method", "amount", "reference", "received_at"]


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "loyalty_points", "is_active"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source="customer.name", read_only=True, default=None)
    branch_code = serializers.CharField(source="branch.code", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "branch", "branch_code", "terminal", "customer", "customer_name",
            "sale_number", "status", "subtotal", "discount_amount",
            "tax_amount", "total_amount", "notes", "sold_at", "created_at",
            "voided_at", "void_reason", "items", "payments",
        ]
        read_only_fields = [
            "sale_number", "status", "subtotal", "discount_amount",
            "tax_amount", "total_amount", "sold_at", "voided_at", "void_reason",
        ]
