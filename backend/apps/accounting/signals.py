# backend/apps/accounting/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.expenses.models import Expense
from .models import Account
from .services import post_journal_entry

# Maps Expense.payment_method to the asset account it reduces.
PAYMENT_METHOD_ACCOUNT_CODE = {
    "cash": "1000",
    "bank": "1010",
    "mobile_banking": "1020",
}

# Falls back to one general expense account for now. A more precise
# mapping (e.g. ExpenseCategory -> Account) can be added later without
# touching this signal's structure — just change how debit_code is chosen.
DEFAULT_EXPENSE_ACCOUNT_CODE = "5300"


@receiver(post_save, sender=Expense)
def post_expense_journal_entry(sender, instance, created, **kwargs):
    """
    Auto-posts a simple two-line journal entry whenever a new Expense is
    saved: Debit the expense account, Credit the cash/bank/mobile-banking
    account matching how it was paid.

    This lives in `accounting`, not `expenses` — apps.expenses must never
    import from apps.accounting, since accounting sits above it in the
    app layering (dependencies flow upward only). Listening via a signal
    here keeps the dependency direction correct: accounting depends on
    expenses, never the reverse.

    Only fires on creation, not on edits — updating an already-posted
    expense does not currently repost or reverse the journal entry.
    Silently skips if the organization's chart of accounts isn't seeded
    yet (missing debit/credit account), rather than raising, since a
    missing seed shouldn't block saving an expense.
    """
    if not created:
        return

    organization = instance.branch.organization
    debit_account = Account.objects.filter(
        organization=organization, code=DEFAULT_EXPENSE_ACCOUNT_CODE).first()
    credit_code = PAYMENT_METHOD_ACCOUNT_CODE.get(
        instance.payment_method, "1000")
    credit_account = Account.objects.filter(
        organization=organization, code=credit_code).first()

    if not debit_account or not credit_account:
        return

    post_journal_entry(
        branch=instance.branch,
        entry_date=instance.expense_date,
        description=f"Expense: {instance.category.name}",
        reference_type="expense",
        reference_id=instance.id,
        idempotency_key=f"expense:{instance.id}",
        lines=[
            {"account": debit_account, "debit": instance.amount, "credit": 0},
            {"account": credit_account, "debit": 0, "credit": instance.amount},
        ],
    )
