# backend/apps/sales/serializers.py

from rest_framework import serializers
from .models import Sale, SaleItem, Payment, Customer


class SaleItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            "id", "product", "product_sku", "product_name",
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
