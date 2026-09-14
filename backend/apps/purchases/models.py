from django.conf import settings
from django.db import models
from apps.core.models import BaseModel

PO_STATUS_CHOICES = [
    ("draft", "Draft"),
    ("ordered", "Ordered"),
    ("partially_received", "Partially Received"),
    ("received", "Received"),
    ("cancelled", "Cancelled"),
]


class Supplier(BaseModel):
    """Org-scoped, like Product — a supplier can sell to any branch of the
    same organization."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="suppliers"
    )
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class BranchPurchaseSequence(BaseModel):
    """
    One row per branch, tracking the last-used PO number for that branch —
    the same gapless-sequential pattern as sales.BranchSaleSequence.

    Only used when the PO's reference_number isn't supplied by the
    caller. If a supplier issues their own PO/invoice reference, that is
    used as-is instead (see PurchaseOrder.reference_number and the view's
    perform_create) — this sequence exists purely for the case where
    nobody else is generating a number for us.
    """
    branch = models.OneToOneField(
        "tenants.Branch", on_delete=models.CASCADE, related_name="purchase_sequence"
    )
    last_number = models.PositiveIntegerField(default=0)


class PurchaseOrder(BaseModel):
    """
    The purchase itself. Stock is NOT adjusted just by creating this row —
    it's adjusted only when items are marked received, via
    apps.purchases.services.receive_purchase_order_item(), which calls
    inventory.services.record_movement() per item. This mirrors real
    purchasing: ordering something doesn't put it on your shelf, receiving
    it does.
    """
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.PROTECT, related_name="purchase_orders"
    )
    supplier = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name="purchase_orders"
    )
    reference_number = models.CharField(max_length=50, unique=True)
    is_supplier_reference = models.BooleanField(
        default=False,
        help_text="True if reference_number was supplied by the supplier "
                   "(their own PO/invoice number) rather than auto-generated."
    )
    status = models.CharField(max_length=20, choices=PO_STATUS_CHOICES, default="draft")
    order_date = models.DateField()
    expected_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"{self.reference_number} — {self.supplier.name}"


class PurchaseOrderItem(BaseModel):
    """One line of a PurchaseOrder. quantity_ordered vs quantity_received
    are tracked separately so partial receiving is representable without
    losing what was originally ordered."""
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name="items"
    )
    product = models.ForeignKey("catalog.Product", on_delete=models.PROTECT)
    quantity_ordered = models.DecimalField(max_digits=14, decimal_places=3)
    quantity_received = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    unit_cost = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.product.sku} x{self.quantity_ordered}"
