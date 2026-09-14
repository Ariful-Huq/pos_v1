from rest_framework import serializers
from apps.tenants.models import Branch
from .models import Supplier, PurchaseOrder, PurchaseOrderItem


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "email", "address", "is_active"]


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id", "product", "product_sku", "product_name",
            "quantity_ordered", "quantity_received", "unit_cost",
        ]
        read_only_fields = ["quantity_received"]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """
    Writable nested serializer: creating a PurchaseOrder also creates its
    line items in the same request — the frontend sends the whole PO
    (header + items) as one payload rather than making N+1 calls.

    branch: still optional from the client for backward compatibility
    (falls back to X-Active-Branch in the view), but the frontend now
    always sends it explicitly via a warehouse/branch selector on the PO
    form, since relying solely on "whichever branch happens to be
    active" was too easy to get wrong when creating a PO for a different
    location.

    reference_number: optional. If the client supplies one, it's treated
    as the SUPPLIER'S own reference/invoice number and used as-is
    (is_supplier_reference=True). If omitted, the view auto-generates a
    gapless sequential number per branch (is_supplier_reference=False).
    """
    items = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False)
    branch_code = serializers.CharField(source="branch.code", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    reference_number = serializers.CharField(required=False)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "branch", "branch_code", "branch_name", "supplier", "supplier_name",
            "reference_number", "is_supplier_reference",
            "status", "order_date", "expected_date", "notes", "items",
        ]
        read_only_fields = ["status", "is_supplier_reference"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        purchase_order = PurchaseOrder.objects.create(**validated_data)
        for item_data in items_data:
            PurchaseOrderItem.objects.create(purchase_order=purchase_order, **item_data)
        return purchase_order
