from decimal import Decimal
from django.db import transaction
from apps.inventory.services import record_movement
from .models import PurchaseOrder, BranchPurchaseSequence


def generate_po_number(branch):
    """
    Locks the branch's purchase sequence row and returns the next
    gapless PO number, formatted like 'PO-DHK-01-000042' — same pattern
    as sales.services.generate_sale_number(). Only called when the
    caller didn't supply their own reference_number (i.e. no supplier
    reference was given).
    """
    seq, _ = BranchPurchaseSequence.objects.select_for_update().get_or_create(
        branch=branch, defaults={"last_number": 0}
    )
    seq.last_number += 1
    seq.save(update_fields=["last_number"])
    return f"PO-{branch.code}-{seq.last_number:06d}"


def receive_purchase_order_item(item, quantity, received_by=None):
    """
    Receives a quantity against ONE PurchaseOrderItem. This is what
    actually moves stock — creating a PurchaseOrder/PurchaseOrderItem row
    does NOT touch inventory by itself.

    idempotency_key is built from the item's own id plus the cumulative
    received total at the time of this call, so re-running the exact same
    receive action twice (e.g. a retried API call) won't double-count —
    consistent with how inventory.services.record_movement() expects to
    be called.
    """
    with transaction.atomic():
        new_total_received = item.quantity_received + Decimal(quantity)
        idempotency_key = f"purchase_item:{item.id}:received_to:{new_total_received}"

        record_movement(
            product=item.product,
            branch=item.purchase_order.branch,
            movement_type="purchase",
            quantity=Decimal(quantity),
            idempotency_key=idempotency_key,
            reference_type="purchase_order_item",
            reference_id=item.id,
            created_by=received_by,
        )

        item.quantity_received = new_total_received
        item.save(update_fields=["quantity_received"])

        _update_po_status(item.purchase_order)

        return item


def _update_po_status(purchase_order):
    items = purchase_order.items.all()
    if all(i.quantity_received >= i.quantity_ordered for i in items):
        purchase_order.status = "received"
    elif any(i.quantity_received > 0 for i in items):
        purchase_order.status = "partially_received"
    purchase_order.save(update_fields=["status"])
