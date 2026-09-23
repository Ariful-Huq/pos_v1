# backend/apps/sales/serializers.py

from rest_framework import serializers
from apps.tenants.models import Organization
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
    # Customer has no unique_together involving organization (unlike
    # Product), so a plain required=False field + view-side
    # perform_create() default is enough — see CategorySerializer for the
    # same pattern and why Product needs the heavier HiddenField instead.
    organization = serializers.PrimaryKeyRelatedField(
        queryset=Organization.objects.all(), required=False
    )

    class Meta:
        model = Customer
        fields = ["id", "organization", "name",
                  "phone", "loyalty_points", "is_active"]


class CustomerSaleHistorySerializer(serializers.ModelSerializer):
    """Slim, read-only view of a Sale for the POS 'purchase history' panel
    on a selected customer — just enough to list past visits, not the
    full line-item/payment detail SaleSerializer carries."""

    class Meta:
        model = Sale
        fields = ["id", "sale_number", "status",
                  "total_amount", "sold_at", "created_at"]


class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source="customer.name", read_only=True, default=None)
    branch_code = serializers.CharField(source="branch.code", read_only=True)
    # Needed by the POS receipt printout (name/address/phone in the header)
    # so it doesn't have to rely on the cashier's own branch_access list,
    # which won't always include every branch a sale could belong to.
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    branch_address = serializers.CharField(source="branch.address", read_only=True)
    branch_phone = serializers.CharField(source="branch.phone", read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id", "branch", "branch_code", "branch_name", "branch_address",
            "branch_phone", "terminal", "customer", "customer_name",
            "sale_number", "status", "subtotal", "discount_amount",
            "tax_amount", "total_amount", "notes", "sold_at", "created_at",
            "voided_at", "void_reason", "items", "payments",
        ]
        read_only_fields = [
            "sale_number", "status", "subtotal", "discount_amount",
            "tax_amount", "total_amount", "sold_at", "voided_at", "void_reason",
        ]
