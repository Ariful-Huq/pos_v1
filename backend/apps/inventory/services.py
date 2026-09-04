# backend/apps/inventory/services.py
#
# UPDATED —
# Only change: an optional `variant=None` kwarg threaded through all three
# functions. Every existing caller (sales, purchases, expenses) keeps
# calling record_movement()/get_stock_level() exactly as before — variant
# defaults to None, which is the same "simple product" behavior as today.
# apps/ecommerce/services.py is the one caller that passes variant=... .

from django.db import transaction
from .models import StockMovement, StockLevel


def record_movement(
    product,
    branch,
    movement_type,
    quantity,
    idempotency_key,
    variant=None,
    reference_type="",
    reference_id=None,
    notes="",
    created_by=None,
):
    """
    The ONLY function anything outside `inventory` should call to change
    stock. sales/purchases/expenses/ecommerce must never write to
    StockMovement or StockLevel directly.

    quantity: signed Decimal — positive increases stock, negative decreases
    it. The caller decides the sign; movement_type is just a label.

    variant: pass the ProductVariant when the product is variant-tracked
    (Product.product_type == "variant"). Leave as None for simple products
    — identical behavior to before this parameter existed.

    idempotency_key: pass something stable and unique to the originating
    event (e.g. f"sale:{sale_id}:line:{line_id}" or
    f"order:{order_id}:item:{item_id}:reserve"). If a movement with this
    key already exists, this function returns it WITHOUT creating a
    duplicate or double-adjusting the stock level — this is what makes
    offline sync retries (and e-commerce checkout retries) safe.
    """
    with transaction.atomic():
        existing = StockMovement.objects.filter(
            idempotency_key=idempotency_key).first()
        if existing:
            return existing
        movement = StockMovement.objects.create(
            product=product,
            variant=variant,
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
            product=product, branch=branch, variant=variant, defaults={
                "quantity": 0}
        )
        level.quantity = level.quantity + quantity
        level.save(update_fields=["quantity"])
        return movement


def get_stock_level(product, branch, variant=None):
    """Returns the current cached quantity, or 0 if no movements exist yet
    for this (product, branch[, variant]) combination."""
    level = StockLevel.objects.filter(
        product=product, branch=branch, variant=variant).first()
    return level.quantity if level else 0


def recalculate_stock_level(product, branch, variant=None):
    """Rebuilds StockLevel from the ledger for one (product, branch[, variant])
    combination. Use this if the cache and the ledger ever disagree — the
    ledger (StockMovement) is always the source of truth."""
    from django.db.models import Sum
    total = StockMovement.objects.filter(
        product=product, branch=branch, variant=variant
    ).aggregate(total=Sum("quantity"))["total"] or 0
    level, _ = StockLevel.objects.get_or_create(
        product=product, branch=branch, variant=variant, defaults={
            "quantity": 0}
    )
    level.quantity = total
    level.save(update_fields=["quantity"])
    return level
