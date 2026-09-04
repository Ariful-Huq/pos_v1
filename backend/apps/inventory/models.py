# backend/apps/inventory/models.py
#
# UPDATED —
# Change is minimal and additive: a nullable `variant` FK on both
# StockMovement and StockLevel. NULL variant = simple product, behaves
# exactly as before. A row is never re-keyed — existing StockMovement rows
# for simple products keep variant=NULL forever, nothing to backfill.

from django.conf import settings
from django.db import models
from apps.core.models import BaseModel

MOVEMENT_TYPES = [
    ("purchase", "Purchase"),
    ("sale", "Sale"),
    ("adjustment", "Adjustment"),
    ("transfer_in", "Transfer In"),
    ("transfer_out", "Transfer Out"),
    ("return_in", "Return In"),
    ("return_out", "Return Out"),
    # --- NEW for e-commerce ---
    # Two extra types rather than reusing "sale"/"return_in": an online
    # reservation is provisional (order might still be cancelled before
    # payment/fulfillment), which is a meaningfully different event from a
    # completed POS sale. Keeping them distinct means reporting can tell
    # "stock committed to a pending web order" apart from "stock that left
    # the building" without re-deriving it from Order state.
    ("ecommerce_reservation", "E-commerce Reservation"),
    ("ecommerce_release", "E-commerce Release"),
]


class StockMovement(BaseModel):
    """
    THE LEDGER. This is the single source of truth for stock — every
    purchase, sale, transfer, return, and manual adjustment creates a row
    here. Rows are never edited or deleted after creation; a mistake is
    corrected with a new offsetting movement, not by changing history.

    `quantity` is SIGNED: positive means stock increased, negative means
    it decreased. `movement_type` is purely a label for reporting/
    filtering — it does not determine the sign, the caller does, via
    apps.inventory.services.record_movement().

    `variant` is NEW and nullable: NULL means this movement is against the
    simple Product itself (unchanged from before). Set it when the product
    is variant-tracked (Product.product_type == "variant") — in that case
    `product` is still set too (for querying "all movements for this
    product across variants"), `variant` narrows it to the specific SKU.

    `idempotency_key` is what makes offline sync safe: a branch terminal
    that creates a sale offline generates this key locally (e.g. a UUID
    tied to that specific sale line), and if the sync retries after a
    network drop, record_movement() will see the key already exists and
    skip creating a duplicate — so retries can never double-deduct stock.

    NEVER write directly to this table from sales/purchases/ecommerce/etc.
    — always go through apps.inventory.services.record_movement().
    """
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.PROTECT, related_name="stock_movements"
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant", on_delete=models.PROTECT, related_name="stock_movements",
        null=True, blank=True,
    )
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.PROTECT, related_name="stock_movements"
    )
    movement_type = models.CharField(max_length=30, choices=MOVEMENT_TYPES)
    quantity = models.DecimalField(max_digits=14, decimal_places=3)  # signed
    reference_type = models.CharField(
        max_length=50, blank=True)  # e.g. "sale", "purchase"
    reference_id = models.UUIDField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=100, unique=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        indexes = [models.Index(fields=["product", "branch"]), models.Index(
            fields=["variant", "branch"])]

    def __str__(self):
        return f"{self.movement_type} {self.quantity} — {self.product.sku} @ {self.branch.code}"


class StockLevel(BaseModel):
    """
    A materialized CACHE of current quantity per (product, branch[, variant]),
    derived entirely from StockMovement rows. This exists purely so
    reading "how much stock is at Branch X" doesn't require summing
    potentially thousands of ledger rows on every request.

    NEVER write to this table directly from outside apps.inventory.services
    — it is always updated as a side effect of record_movement(), inside the
    same transaction as the ledger row. If this table and the ledger ever
    disagree, the ledger is correct and this table needs to be recalculated
    from it.

    `variant` NEW and nullable, same meaning as on StockMovement: NULL row
    is the simple-product level (unchanged), a variant row tracks that SKU
    specifically.
    """
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.CASCADE, related_name="stock_levels"
    )
    variant = models.ForeignKey(
        "catalog.ProductVariant", on_delete=models.CASCADE, related_name="stock_levels",
        null=True, blank=True,
    )
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.CASCADE, related_name="stock_levels"
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        unique_together = ("product", "branch", "variant")

    def __str__(self):
        suffix = f" [{self.variant.sku}]" if self.variant_id else ""
        return f"{self.product.sku}{suffix} @ {self.branch.code}: {self.quantity}"
