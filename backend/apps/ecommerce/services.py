# backend/apps/ecommerce/services.py

"""
TODO once you share apps/inventory/services.py: confirm the exact keyword
arguments record_movement() expects (movement_type choices, whether it takes
`product` or `variant`, etc.) and adjust reserve_stock_for_order() below —
the call is written against the *documented* shape from the pos_v1 SSOT
("record_movement() ... idempotent via an idempotency_key"), not the literal
source, since I haven't seen it yet.
"""
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.inventory.services import record_movement  # TODO: confirm signature
from .models import Cart, CartItem, Order, OrderItem, Payment
from .payments import get_provider


class CheckoutError(Exception):
    pass


# ---------------------------------------------------------------------------
# Cart mutation — merges repeated product+variant lines, same as
# sales.services.add_item() merging repeated product+price lines.
# ---------------------------------------------------------------------------
@transaction.atomic
def add_to_cart(cart: Cart, product, variant, quantity: int, unit_price: Decimal) -> CartItem:
    cart = Cart.objects.select_for_update().get(pk=cart.pk)
    item, created = CartItem.objects.get_or_create(
        cart=cart, product=product, variant=variant,
        defaults={"quantity": quantity, "unit_price_snapshot": unit_price},
    )
    if not created:
        item.quantity += quantity
        item.unit_price_snapshot = unit_price  # refresh snapshot to current price
        item.save(update_fields=["quantity", "unit_price_snapshot"])
    return item


@transaction.atomic
def update_cart_item_quantity(cart_item: CartItem, quantity: int) -> CartItem:
    cart_item = CartItem.objects.select_for_update().get(pk=cart_item.pk)
    if quantity <= 0:
        cart_item.delete()
        return None
    cart_item.quantity = quantity
    cart_item.save(update_fields=["quantity"])
    return cart_item


# ---------------------------------------------------------------------------
# Checkout — the critical transition. See §4 of the SSOT for the
# reserve-at-checkout vs reserve-at-payment tradeoff this implements.
# ---------------------------------------------------------------------------
def _generate_order_number() -> str:
    # TODO: replace with a gapless per-branch sequence if you want the same
    # rigor as sales.BranchSaleSequence. A UUID-derived number is fine for
    # local testing but isn't gapless/sequential.
    return f"WEB-{timezone.now():%Y%m%d}-{uuid.uuid4().hex[:8].upper()}"


def reserve_stock_for_order(order: Order):
    for item in order.items.select_related("variant", "product"):
        record_movement(
            product=item.product,
            variant=item.variant,               # None for simple products
            branch=order.fulfillment_branch,
            quantity=-item.quantity,            # signed: reservation reduces available stock
            movement_type="ecommerce_reservation",
            reference_type="ecommerce_order",
            reference_id=order.id,
            idempotency_key=f"order-reserve-{order.id}-{item.id}",
        )


def release_stock_for_order(order: Order):
    for item in order.items.select_related("variant", "product"):
        record_movement(
            product=item.product,
            variant=item.variant,
            branch=order.fulfillment_branch,
            quantity=item.quantity,             # reverse of the reservation
            movement_type="ecommerce_release",
            reference_type="ecommerce_order",
            reference_id=order.id,
            idempotency_key=f"order-release-{order.id}-{item.id}",
        )


@transaction.atomic
def checkout(cart: Cart, shipping_address, payment_method: str, organization,
             fulfillment_branch, customer=None, guest_email="", guest_phone="",
             idempotency_key=None) -> Order:
    cart = Cart.objects.select_for_update().get(pk=cart.pk)
    if cart.status != "active":
        raise CheckoutError("Cart is not active.")

    items = list(cart.items.select_related("product", "variant"))
    if not items:
        raise CheckoutError("Cart is empty.")

    if idempotency_key:
        existing = Order.objects.filter(
            idempotency_key=idempotency_key).first()
        if existing:
            return existing  # duplicate submit — same guarantee record_movement() gives you

    subtotal = sum(
        (i.unit_price_snapshot * i.quantity for i in items), Decimal("0"))

    order = Order.objects.create(
        organization=organization,
        fulfillment_branch=fulfillment_branch,
        customer=customer,
        shipping_address=shipping_address,
        guest_email=guest_email,
        guest_phone=guest_phone,
        subtotal=subtotal,
        total=subtotal,  # extend with shipping/tax when that's designed
        idempotency_key=idempotency_key,
        status="pending_payment",
    )
    for i in items:
        OrderItem.objects.create(
            order=order,
            product=i.product,
            variant=i.variant,
            product_name_snapshot=i.product.name,
            unit_price_snapshot=i.unit_price_snapshot,
            quantity=i.quantity,
        )

    reserve_stock_for_order(order)

    provider = get_provider(payment_method)
    result = provider.initiate(order)
    Payment.objects.create(
        order=order,
        method=payment_method,
        status=result.status,
        amount=order.total,
        provider_reference=result.provider_reference,
    )

    if payment_method == "cod":
        order.order_number = _generate_order_number()
        order.status = "confirmed"
        order.save(update_fields=["order_number", "status"])
    # cosmetic methods stay in pending_payment honestly — see payments.py

    cart.status = "converted"
    cart.save(update_fields=["status"])
    return order


@transaction.atomic
def cancel_order(order: Order):
    if order.status in ("cancelled", "refunded"):
        return order
    release_stock_for_order(order)
    order.status = "cancelled"
    order.save(update_fields=["status"])
    return order
