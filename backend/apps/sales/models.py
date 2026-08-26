# backend/apps/sales/models.py

from django.conf import settings
from django.db import models
from apps.core.models import BaseModel

SALE_STATUS_CHOICES = [
    ("draft", "Draft"),                        # parked/held cart, not yet paid
    ("completed", "Completed"),
    ("void", "Void"),
    ("refunded", "Refunded"),
    ("partially_refunded", "Partially Refunded"),
]

PAYMENT_METHOD_CHOICES = [
    ("cash", "Cash"),
    ("card", "Card"),
    ("mobile_banking", "Mobile Banking"),      # bKash/Nagad/Rocket etc.
    ("store_credit", "Store Credit"),
    ("due", "Due / Credit Sale"),
]


class Customer(BaseModel):
    """Optional — sales can be walk-in (Sale.customer = null). Kept
    lightweight on purpose; loyalty_points is a simple running counter,
    not a full loyalty/rewards engine."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="customers"
    )
    name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30, blank=True, db_index=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name or self.phone or str(self.id)


class BranchSaleSequence(BaseModel):
    """One row per branch, tracking the last-used invoice number for that
    branch. Sale numbers must be sequential with no gaps (BD tax/audit
    requirement) — always generate the next number via
    services.generate_sale_number(), which locks this row
    (select_for_update) inside a transaction. NEVER derive a sale number
    by counting existing Sale rows — that's not safe under concurrency
    and breaks the moment a sale is voided or deleted."""
    branch = models.OneToOneField(
        "tenants.Branch", on_delete=models.CASCADE, related_name="sale_sequence"
    )
    last_number = models.PositiveIntegerField(default=0)


class Sale(BaseModel):
    """
    The sale header. A Sale starts as 'draft' (a parked/held cart — modern
    POS UX lets a cashier start a sale, hold it, and resume or complete it
    later). sale_number is intentionally left null until the sale is
    actually completed — assigning it at draft time would create gaps in
    the sequence whenever a cart is abandoned.
    """
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.PROTECT, related_name="sales")
    terminal = models.ForeignKey(
        "tenants.Terminal", null=True, blank=True, on_delete=models.SET_NULL, related_name="sales"
    )
    customer = models.ForeignKey(
        Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="sales"
    )
    sale_number = models.CharField(
        max_length=30, unique=True, null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=SALE_STATUS_CHOICES, default="draft")

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0)
    tax_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0)

    notes = models.TextField(blank=True)
    sold_at = models.DateTimeField(
        null=True, blank=True)     # set when completed
    voided_at = models.DateTimeField(null=True, blank=True)
    void_reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sales_created"
    )

    def __str__(self):
        return self.sale_number or f"(draft) {self.id}"


class SaleItem(BaseModel):
    """
    unit_price is a SNAPSHOT taken at the moment the item is added to the
    sale — it is never re-read from Product.selling_price afterward.
    Product prices change over time; a historical invoice must never
    silently reprice itself just because someone edited the catalog later.
    """
    sale = models.ForeignKey(
        Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.PROTECT, related_name="sale_items"
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)
    quantity_returned = models.DecimalField(
        max_digits=14, decimal_places=3, default=0)

    def __str__(self):
        return f"{self.product.sku} x{self.quantity}"


class Payment(BaseModel):
    """
    A Sale can have MULTIPLE Payment rows — e.g. part cash, part mobile
    banking, a very common split in BD retail. Once a sale is completed,
    sum(Payment.amount for that sale) should equal Sale.total_amount;
    services.complete_sale() enforces this before marking the sale done.
    """
    sale = models.ForeignKey(
        Sale, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    # e.g. mobile banking txn id
    reference = models.CharField(max_length=100, blank=True)
    received_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.method} {self.amount}"


class SaleReturn(BaseModel):
    """A return/refund event against an already-completed Sale. Line-level
    detail lives in SaleReturnItem; this header groups them and records
    who processed the return and why — important for shrinkage/fraud
    review later."""
    sale = models.ForeignKey(
        Sale, on_delete=models.PROTECT, related_name="returns")
    reason = models.TextField(blank=True)
    refund_amount = models.DecimalField(
        max_digits=14, decimal_places=2, default=0)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"Return for {self.sale.sale_number}"


class SaleReturnItem(BaseModel):
    sale_return = models.ForeignKey(
        SaleReturn, on_delete=models.CASCADE, related_name="items")
    sale_item = models.ForeignKey(
        SaleItem, on_delete=models.PROTECT, related_name="return_items")
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.quantity} of {self.sale_item.product.sku}"
