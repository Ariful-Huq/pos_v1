# backend/apps/inventory/models.py

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

    `idempotency_key` is what makes offline sync safe: a branch terminal
    that creates a sale offline generates this key locally (e.g. a UUID
    tied to that specific sale line), and if the sync retries after a
    network drop, record_movement() will see the key already exists and
    skip creating a duplicate — so retries can never double-deduct stock.

    NEVER write directly to this table from sales/purchases/etc. — always
    go through apps.inventory.services.record_movement().
    """
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.PROTECT, related_name="stock_movements"
    )
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.PROTECT, related_name="stock_movements"
    )
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES)
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
        indexes = [models.Index(fields=["product", "branch"])]

    def __str__(self):
        return f"{self.movement_type} {self.quantity} — {self.product.sku} @ {self.branch.code}"


class StockLevel(BaseModel):
    """
    A materialized CACHE of current quantity per (product, branch),
    derived entirely from StockMovement rows. This exists purely so
    reading "how much stock is at Branch X" doesn't require summing
    potentially thousands of ledger rows on every request.

    NEVER write to this table directly from outside
    apps.inventory.services — it is always updated as a side effect of
    record_movement(), inside the same transaction as the ledger row.
    If this table and the ledger ever disagree, the ledger is correct
    and this table needs to be recalculated from it.
    """
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.CASCADE, related_name="stock_levels"
    )
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.CASCADE, related_name="stock_levels"
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3, default=0)

    class Meta:
        unique_together = ("product", "branch")

    def __str__(self):
        return f"{self.product.sku} @ {self.branch.code}: {self.quantity}"
