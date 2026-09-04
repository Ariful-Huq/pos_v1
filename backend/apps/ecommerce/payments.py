# backend/apps/ecommerce/payments.py

"""
Deliberately mirrors apps.notifications.providers.SMSProvider's shape — a
swappable abstraction you already trust. COD is real. Everything else is a
cosmetic stub that tells the truth about being a stub, matching the "honest
stubs over fake functionality" rule in the pos_v1 SSOT (the POS's promo-code
and customer-selection stubs work the same way).
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PaymentResult:
    status: str  # "pending_collection" | "not_implemented" | "succeeded" | "failed"
    provider_reference: str | None = None
    message: str = ""


class PaymentProvider(ABC):
    method_code: str

    @abstractmethod
    def initiate(self, order) -> PaymentResult:
        """Called at checkout. Should not raise for a cosmetic/unimplemented method —
        return a PaymentResult with status='not_implemented' instead, so the order
        can still be created and clearly labeled."""

    @abstractmethod
    def verify(self, provider_reference: str) -> str:
        """Return current status for a previously-initiated payment."""


class CODProvider(PaymentProvider):
    """Real for local dev — no external call. Cash is collected on delivery,
    so the order can be confirmed immediately; the Payment row just tracks
    that collection is still owed."""
    method_code = "cod"

    def initiate(self, order) -> PaymentResult:
        return PaymentResult(status="pending_collection", message="Pay on delivery")

    def verify(self, provider_reference: str) -> str:
        return "pending_collection"


class CosmeticProvider(PaymentProvider):
    """bKash / Nagad / Card. Selectable in the storefront UI, recorded on the
    order, settles nothing yet. Swap in a real SSLCommerz/bKash sandbox
    integration later by replacing PAYMENT_PROVIDERS[method] — callers
    (ecommerce.services.checkout) don't change."""

    def __init__(self, method_code: str):
        self.method_code = method_code

    def initiate(self, order) -> PaymentResult:
        return PaymentResult(
            status="not_implemented",
            message=f"{self.method_code} is not wired to a live gateway yet. "
            f"Order is recorded as pending_payment.",
        )

    def verify(self, provider_reference: str) -> str:
        return "not_implemented"


PAYMENT_PROVIDERS: dict[str, PaymentProvider] = {
    "cod": CODProvider(),
    "bkash": CosmeticProvider("bkash"),
    "nagad": CosmeticProvider("nagad"),
    "card": CosmeticProvider("card"),
}


def get_provider(method_code: str) -> PaymentProvider:
    try:
        return PAYMENT_PROVIDERS[method_code]
    except KeyError:
        raise ValueError(f"Unknown payment method: {method_code}")
