# backend/apps/notifications/providers.py

from abc import ABC, abstractmethod


class SMSProvider(ABC):
    """Every real gateway (a BD bulk-SMS aggregator, etc.) implements this
    interface. Nothing in sales/inventory/etc. ever imports a specific
    provider directly — they call notifications.services.send_notification()
    and the provider is swapped via settings.SMS_PROVIDER."""

    @abstractmethod
    def send(self, to: str, message: str) -> bool:
        """Return True on success, False on failure. Should not raise for
        expected failure modes (invalid number, gateway timeout) — return
        False and let the caller log it."""
        raise NotImplementedError


class ConsoleSMSProvider(SMSProvider):
    """Dev/local default — just prints to the console instead of sending
    a real SMS. Zero cost, zero setup, safe for local testing."""

    def send(self, to: str, message: str) -> bool:
        print(f"[SMS to {to}]: {message}")
        return True


# Add real providers here later, e.g.:
# class SomeBDGatewayProvider(SMSProvider):
#     def send(self, to, message):
#         ... call the gateway's API ...
