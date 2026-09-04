# backend/apps/ecommerce/models.py

"""
Layer 5 (alongside sales/purchases/expenses). Depends only on core, tenants,
catalog, inventory — never imports from sales, per the upward-only rule in
the pos_v1 SSOT.

NOTE: BaseModel is assumed to provide a UUID primary key + created_at/updated_at,
matching the description in the pos_v1 SSOT (§ core app). If your actual
apps/core/models.py differs, adjust the import/fields below — everything else
in this file is independent of that detail.
"""
import uuid

from django.conf import settings
from django.db import models

from apps.core.models import BaseModel
from apps.tenants.models import Branch, Organization
from apps.catalog.models import Product, ProductVariant


# ---------------------------------------------------------------------------
# Customer identity — deliberately separate from staff auth.User/StaffProfile.
# Customers never intersect with authz roles/features.
# ---------------------------------------------------------------------------
class CustomerAccount(BaseModel):
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="customer_accounts")
    email = models.EmailField(unique=True)
    # set via set_password(), never stored raw
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)

    def set_password(self, raw_password):
        from django.contrib.auth.hashers import make_password
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        from django.contrib.auth.hashers import check_password
        return check_password(raw_password, self.password_hash)

    def __str__(self):
        return self.email


class Address(BaseModel):
    customer = models.ForeignKey(
        CustomerAccount, on_delete=models.CASCADE, related_name="addresses",
        null=True, blank=True,  # null = guest checkout address, not reusable
    )
    label = models.CharField(max_length=50, blank=True)  # "Home", "Work"
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    area = models.CharField(max_length=100, blank=True)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.full_name} — {self.line1}, {self.city}"


# ---------------------------------------------------------------------------
# Cart — guest (session_key) or authenticated (customer)
# ---------------------------------------------------------------------------
class Cart(BaseModel):
    STATUS_CHOICES = [
        ("active", "Active"),
        ("converted", "Converted"),
        ("abandoned", "Abandoned"),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="carts")
    customer = models.ForeignKey(
        CustomerAccount, on_delete=models.SET_NULL, related_name="carts", null=True, blank=True
    )
    session_key = models.CharField(
        max_length=64, null=True, blank=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="active")

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(customer__isnull=False) | models.Q(
                    session_key__isnull=False),
                name="ecommerce_cart_customer_or_session",
            )
        ]

    def __str__(self):
        return f"Cart {self.id} ({self.status})"


class CartItem(BaseModel):
    cart = models.ForeignKey(
        Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="+")
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.PROTECT, related_name="+", null=True, blank=True
    )
    quantity = models.PositiveIntegerField(default=1)
    # snapshot — same pattern as sales.SaleItem.unit_price: price can move
    # between "added to cart" and "checked out"; the snapshot protects intent.
    unit_price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "product", "variant"], name="ecommerce_cartitem_unique_line"
            )
        ]


# ---------------------------------------------------------------------------
# Order — lifecycle mirrors sales.Sale on purpose (pattern consistency):
# pending_payment -> confirmed -> fulfilled, or cancelled/refunded.
# order_number assigned at confirmation, not at creation.
# ---------------------------------------------------------------------------
class Order(BaseModel):
    STATUS_CHOICES = [
        ("pending_payment", "Pending Payment"),
        ("confirmed", "Confirmed"),
        ("fulfilled", "Fulfilled"),
        ("cancelled", "Cancelled"),
        ("refunded", "Refunded"),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="ecommerce_orders")
    fulfillment_branch = models.ForeignKey(
        Branch, on_delete=models.PROTECT, related_name="ecommerce_orders",
        help_text="Fixed to ECOMMERCE_FULFILLMENT_BRANCH_ID for now — schema already "
        "supports per-order branch choice for when that's built.",
    )
    customer = models.ForeignKey(
        CustomerAccount, on_delete=models.SET_NULL, related_name="orders", null=True, blank=True
    )
    shipping_address = models.ForeignKey(
        Address, on_delete=models.PROTECT, related_name="+")

    order_number = models.CharField(
        max_length=40, unique=True, null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending_payment")

    # guest contact info — kept on the order even if customer is null
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=32, blank=True)

    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    # idempotency for checkout retries / double-submits, mirrors
    # inventory.services.record_movement()'s idempotency_key pattern
    idempotency_key = models.CharField(
        max_length=64, unique=True, null=True, blank=True)

    def __str__(self):
        return self.order_number or f"Order (draft {self.id})"


class OrderItem(BaseModel):
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="+")
    variant = models.ForeignKey(
        ProductVariant, on_delete=models.PROTECT, related_name="+", null=True, blank=True
    )
    # snapshots — an order must still read correctly after a product is
    # renamed/repriced later, exactly like sales.SaleItem.
    product_name_snapshot = models.CharField(max_length=255)
    unit_price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField()

    @property
    def line_total(self):
        return self.unit_price_snapshot * self.quantity


class Payment(BaseModel):
    METHOD_CHOICES = [
        ("cod", "Cash on Delivery"),
        ("bkash", "bKash"),
        ("nagad", "Nagad"),
        ("card", "Card"),
    ]
    STATUS_CHOICES = [
        ("pending_collection", "Pending Collection"),  # COD — real
        # cosmetic methods, labeled honestly
        ("not_implemented", "Not Implemented"),
        ("succeeded", "Succeeded"),
        ("failed", "Failed"),
    ]
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending_collection")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    provider_reference = models.CharField(
        max_length=100, null=True, blank=True)

    def __str__(self):
        return f"{self.method} — {self.status} — {self.amount}"
