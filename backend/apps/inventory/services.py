# backend/apps/inventory/services.py

from django.db import transaction
from .models import StockMovement, StockLevel


def record_movement(
    product,
    branch,
    movement_type,
    quantity,
    idempotency_key,
    reference_type="",
    reference_id=None,
    notes="",
    created_by=None,
):
    """
    The ONLY function anything outside `inventory` should call to change
    stock. sales/purchases/expenses must never write to StockMovement or
    StockLevel directly.

    quantity: signed Decimal — positive increases stock, negative decreases
    it. The caller decides the sign (e.g. sales passes a negative quantity,
    purchases passes a positive one); movement_type is just a label.

    idempotency_key: pass something stable and unique to the originating
    event (e.g. f"sale:{sale_id}:line:{line_id}"). If a movement with this
    key already exists, this function returns it WITHOUT creating a
    duplicate or double-adjusting the stock level — this is what makes
    offline sync retries safe.
    """
    with transaction.atomic():
        existing = StockMovement.objects.filter(
            idempotency_key=idempotency_key).first()
        if existing:
            return existing

        movement = StockMovement.objects.create(
            product=product,
            branch=branch,
            movement_type=movement_type,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            idempotency_key=idempotency_key,
            notes=notes,
            created_by=created_by,
        )

        level, _ = StockLevel.objects.select_for_update().get_or_create(
            product=product, branch=branch, defaults={"quantity": 0}
        )
        level.quantity = level.quantity + quantity
        level.save(update_fields=["quantity"])

        return movement


def get_stock_level(product, branch):
    """Returns the current cached quantity, or 0 if no movements exist yet
    for this (product, branch) pair."""
    level = StockLevel.objects.filter(product=product, branch=branch).first()
    return level.quantity if level else 0


def recalculate_stock_level(product, branch):
    """Rebuilds StockLevel from the ledger for one (product, branch) pair.
    Use this if the cache and the ledger ever disagree — the ledger
    (StockMovement) is always the source of truth."""
    from django.db.models import Sum

    total = StockMovement.objects.filter(product=product, branch=branch).aggregate(
        total=Sum("quantity")
    )["total"] or 0

    level, _ = StockLevel.objects.get_or_create(
        product=product, branch=branch, defaults={"quantity": 0}
    )
    level.quantity = total
    level.save(update_fields=["quantity"])
    return level
