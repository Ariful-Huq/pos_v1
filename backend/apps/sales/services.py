# backend/apps/sales/services.py

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.inventory.services import record_movement
from .models import Sale, SaleItem, Payment, SaleReturn, SaleReturnItem, BranchSaleSequence


def generate_sale_number(branch):
    """Locks the branch's sequence row and returns the next gapless
    invoice number, formatted like 'DHK-01-000123'. Must be called inside
    the same transaction as marking the sale completed — see
    complete_sale() below."""
    seq, _ = BranchSaleSequence.objects.select_for_update().get_or_create(
        branch=branch, defaults={"last_number": 0}
    )
    seq.last_number += 1
    seq.save(update_fields=["last_number"])
    return f"{branch.code}-{seq.last_number:06d}"


def create_draft_sale(branch, terminal=None, customer=None, created_by=None):
    """Starts a new sale in 'draft' status — this is the 'park/hold a
    cart' entry point. No sale_number is assigned yet, and no stock moves
    yet; both happen only at complete_sale()."""
    return Sale.objects.create(
        branch=branch,
        terminal=terminal,
        customer=customer,
        created_by=created_by,
        status="draft",
    )


def add_item(sale, product, quantity, unit_price=None, discount_amount=Decimal("0"), tax_amount=Decimal("0")):
    """
    Adds a line to a draft sale — or, if this product (at the same
    unit_price) is already on the cart, INCREMENTS that existing line's
    quantity instead of creating a duplicate row. This is what makes
    repeatedly clicking the same product in the POS catalog picker behave
    like a real till (quantity goes up on one line), not like a bug
    (a new line per click).

    The whole operation locks the Sale row (select_for_update) inside a
    transaction, so rapid/overlapping add_item calls for the same sale —
    e.g. a cashier clicking a product several times before the first
    request finishes — serialize instead of racing on the totals
    recalculation below. Without this lock, two nearly-simultaneous
    requests could each read the item list before the other's new/updated
    row committed, silently under-counting the total.
    """
    if unit_price is None:
        unit_price = product.selling_price

    quantity = Decimal(str(quantity))
    unit_price = Decimal(str(unit_price))

    with transaction.atomic():
        locked_sale = Sale.objects.select_for_update().get(pk=sale.pk)

        if locked_sale.status != "draft":
            raise ValueError(
                "Cannot modify a sale that is not in draft status")

        existing_item = locked_sale.items.filter(
            product=product, unit_price=unit_price).first()

        if existing_item:
            existing_item.quantity += quantity
            existing_item.line_total = (
                existing_item.quantity * existing_item.unit_price
                - existing_item.discount_amount
                + existing_item.tax_amount
            )
            existing_item.save(update_fields=["quantity", "line_total"])
            item = existing_item
        else:
            line_total = (quantity * unit_price) - discount_amount + tax_amount
            item = SaleItem.objects.create(
                sale=locked_sale,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
                discount_amount=discount_amount,
                tax_amount=tax_amount,
                line_total=line_total,
            )

        _recalculate_totals(locked_sale)

    return item


def remove_item(sale, item):
    """Removes a line from a draft sale entirely. Locks the sale row for
    the same race-safety reason as add_item()."""
    with transaction.atomic():
        locked_sale = Sale.objects.select_for_update().get(pk=sale.pk)
        if locked_sale.status != "draft":
            raise ValueError(
                "Cannot modify a sale that is not in draft status")
        item.delete()
        _recalculate_totals(locked_sale)


def update_item_quantity(sale, item, quantity):
    """Changes the quantity on an existing draft-sale line (e.g. cashier
    edits the quantity box directly) and recalculates totals. Locks the
    sale row for the same race-safety reason as add_item()."""
    with transaction.atomic():
        locked_sale = Sale.objects.select_for_update().get(pk=sale.pk)
        if locked_sale.status != "draft":
            raise ValueError(
                "Cannot modify a sale that is not in draft status")

        quantity = Decimal(str(quantity))
        if quantity <= 0:
            raise ValueError(
                "Quantity must be greater than zero — use remove_item to delete a line")

        item.quantity = quantity
        item.line_total = (item.quantity * item.unit_price) - \
            item.discount_amount + item.tax_amount
        item.save(update_fields=["quantity", "line_total"])
        _recalculate_totals(locked_sale)

    return item


def _recalculate_totals(sale):
    items = sale.items.all()
    subtotal = sum((i.quantity * i.unit_price for i in items), Decimal("0"))
    discount = sum((i.discount_amount for i in items), Decimal("0"))
    tax = sum((i.tax_amount for i in items), Decimal("0"))
    total = subtotal - discount + tax

    sale.subtotal = subtotal
    sale.discount_amount = discount
    sale.tax_amount = tax
    sale.total_amount = total
    sale.save(update_fields=["subtotal",
              "discount_amount", "tax_amount", "total_amount"])


def complete_sale(sale, payments, completed_by=None):
    """
    Finalizes a draft sale: validates payments cover the total, assigns
    the gapless sale_number, creates Payment rows (supports split
    payments), deducts stock for every line via the inventory ledger, and
    marks the sale completed.

    `payments` is a list of dicts: [{"method": "cash", "amount": 500,
    "reference": ""}, {"method": "mobile_banking", "amount": 200,
    "reference": "TXN123"}]

    Everything happens in one atomic transaction — if stock deduction
    fails partway through (e.g. a product was deleted), the whole sale
    rolls back rather than leaving a half-completed, half-priced sale.
    """
    if sale.status != "draft":
        raise ValueError("Sale is not in draft status")

    total_paid = sum(Decimal(str(p["amount"])) for p in payments)
    if total_paid < sale.total_amount:
        raise ValueError(
            f"Payments ({total_paid}) do not cover the sale total ({sale.total_amount})"
        )

    with transaction.atomic():
        sale.sale_number = generate_sale_number(sale.branch)
        sale.status = "completed"
        sale.sold_at = timezone.now()
        sale.save(update_fields=["sale_number", "status", "sold_at"])

        for p in payments:
            Payment.objects.create(
                sale=sale,
                method=p["method"],
                amount=p["amount"],
                reference=p.get("reference", ""),
            )

        for item in sale.items.all():
            record_movement(
                product=item.product,
                branch=sale.branch,
                movement_type="sale",
                quantity=-item.quantity,  # negative: stock decreases
                idempotency_key=f"sale_item:{item.id}",
                reference_type="sale_item",
                reference_id=item.id,
                created_by=completed_by,
            )

    return sale


def void_sale(sale, reason, voided_by=None):
    """
    Voids a completed sale and reverses its stock deduction. Uses an
    idempotency key tied to the sale itself, so calling this twice by
    mistake does NOT add stock back twice.
    """
    if sale.status != "completed":
        raise ValueError("Only a completed sale can be voided")

    with transaction.atomic():
        for item in sale.items.all():
            record_movement(
                product=item.product,
                branch=sale.branch,
                movement_type="adjustment",
                quantity=item.quantity,  # positive: reversing the earlier deduction
                idempotency_key=f"sale_void:{sale.id}:item:{item.id}",
                reference_type="sale_void",
                reference_id=sale.id,
                created_by=voided_by,
                notes=f"Reversal for voided sale {sale.sale_number}",
            )

        sale.status = "void"
        sale.voided_at = timezone.now()
        sale.void_reason = reason
        sale.save(update_fields=["status", "voided_at", "void_reason"])

    return sale


def process_return(sale, return_lines, reason="", processed_by=None):
    """
    return_lines: list of dicts [{"sale_item": <SaleItem>, "quantity": 2,
    "refund_amount": 100}]. Creates a SaleReturn + SaleReturnItems, puts
    the returned quantity back into stock, and updates the sale's status
    to 'refunded' or 'partially_refunded' depending on how much of the
    total quantity across all items has now been returned.
    """
    if sale.status not in ("completed", "partially_refunded"):
        raise ValueError("Can only return items from a completed sale")

    with transaction.atomic():
        total_refund = sum(Decimal(str(l["refund_amount"]))
                           for l in return_lines)
        sale_return = SaleReturn.objects.create(
            sale=sale, reason=reason, refund_amount=total_refund, processed_by=processed_by
        )

        for line in return_lines:
            sale_item = line["sale_item"]
            qty = Decimal(str(line["quantity"]))

            return_item = SaleReturnItem.objects.create(
                sale_return=sale_return,
                sale_item=sale_item,
                quantity=qty,
                refund_amount=line["refund_amount"],
            )

            record_movement(
                product=sale_item.product,
                branch=sale.branch,
                movement_type="return_in",
                quantity=qty,  # positive: stock increases
                idempotency_key=f"sale_return_item:{return_item.id}",
                reference_type="sale_return_item",
                reference_id=return_item.id,
                created_by=processed_by,
            )

            sale_item.quantity_returned += qty
            sale_item.save(update_fields=["quantity_returned"])

        all_items = sale.items.all()
        if all(i.quantity_returned >= i.quantity for i in all_items):
            sale.status = "refunded"
        else:
            sale.status = "partially_refunded"
        sale.save(update_fields=["status"])

    return sale_return
