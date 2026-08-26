# backend/apps/accounting/models.py

from django.conf import settings
from django.db import models
from apps.core.models import BaseModel

ACCOUNT_TYPE_CHOICES = [
    ("asset", "Asset"),
    ("liability", "Liability"),
    ("equity", "Equity"),
    ("income", "Income"),
    ("expense", "Expense"),
]


class Account(BaseModel):
    """A line in the chart of accounts, e.g. 'Cash', 'Sales Revenue',
    'Inventory Asset', 'Rent Expense'. Org-scoped — one chart of accounts
    per organization, shared across all its branches."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="accounts"
    )
    code = models.CharField(max_length=20)          # e.g. "1000", "4000"
    name = models.CharField(max_length=150)
    account_type = models.CharField(
        max_length=20, choices=ACCOUNT_TYPE_CHOICES)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("organization", "code")

    def __str__(self):
        return f"{self.code} — {self.name}"


class JournalEntry(BaseModel):
    """
    A single accounting event, made up of one or more JournalEntryLine
    rows. Like inventory.StockMovement, this is an IMMUTABLE LEDGER —
    entries are never edited after posting; a correction is made with a
    new offsetting entry, never by changing history.

    idempotency_key follows the same pattern as inventory: build it from
    the originating event (e.g. f"sale:{sale_id}") so re-posting the same
    event (a retried API call, a resynced offline transaction) never
    double-posts.
    """
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.PROTECT, related_name="journal_entries"
    )
    entry_date = models.DateField()
    description = models.CharField(max_length=255, blank=True)
    # e.g. "sale", "purchase", "expense"
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.UUIDField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=100, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"JE {self.id} — {self.description or self.reference_type}"


class JournalEntryLine(BaseModel):
    """One debit or credit line within a JournalEntry. Exactly one of
    debit/credit should be non-zero per line; services.post_journal_entry()
    enforces that total debits == total credits across all lines in an
    entry before it's ever saved."""
    journal_entry = models.ForeignKey(
        JournalEntry, on_delete=models.CASCADE, related_name="lines"
    )
    account = models.ForeignKey(
        Account, on_delete=models.PROTECT, related_name="journal_lines")
    debit = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    def __str__(self):
        side = f"Dr {self.debit}" if self.debit else f"Cr {self.credit}"
        return f"{self.account.code} {side}"
