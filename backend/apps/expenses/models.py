# backend/apps/expenses/models.py

from django.conf import settings
from django.db import models
from apps.core.models import BaseModel

PAYMENT_METHOD_CHOICES = [
    ("cash", "Cash"),
    ("bank", "Bank Transfer"),
    ("mobile_banking", "Mobile Banking"),
]


class ExpenseCategory(BaseModel):
    """Org-scoped, like Product/Supplier — categories are shared across
    all branches of the same organization (e.g. 'Rent', 'Utilities',
    'Transport'), so branch-level reports can still group/compare
    consistently."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="expense_categories"
    )
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "expense categories"

    def __str__(self):
        return self.name


class Expense(BaseModel):
    """
    A single expense record. Branch-scoped (not just org-scoped) because
    per-branch expense comparison is a real, near-term reporting need.

    This does NOT touch the inventory ledger — expenses don't move stock.
    It also does not post directly to accounting yet; once the
    `accounting` app exists, it will read Expense rows to generate
    journal entries, rather than Expense depending on accounting
    (keeps the dependency direction correct per the app layering).
    """
    branch = models.ForeignKey(
        "tenants.Branch", on_delete=models.PROTECT, related_name="expenses"
    )
    category = models.ForeignKey(
        ExpenseCategory, on_delete=models.PROTECT, related_name="expenses"
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    expense_date = models.DateField()
    payment_method = models.CharField(
        max_length=20, choices=PAYMENT_METHOD_CHOICES, default="cash")
    description = models.TextField(blank=True)
    # e.g. receipt/voucher no.
    receipt_reference = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    def __str__(self):
        return f"{self.category.name} — {self.amount} @ {self.branch.code} ({self.expense_date})"
