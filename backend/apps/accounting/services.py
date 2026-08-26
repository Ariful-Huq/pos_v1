# backend/apps/accounting/services.py

from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q

from .models import JournalEntry, JournalEntryLine


def post_journal_entry(
    branch,
    entry_date,
    lines,
    description="",
    reference_type="",
    reference_id=None,
    idempotency_key=None,
    created_by=None,
):
    """
    The ONLY function that should create JournalEntry/JournalEntryLine
    rows. sales/purchases/expenses call this rather than writing to these
    tables directly — same pattern as inventory.services.record_movement().

    lines: list of dicts, e.g.
        [{"account": cash_account, "debit": 175, "credit": 0},
         {"account": sales_revenue_account, "debit": 0, "credit": 175}]

    Rejects the entry if total debits != total credits — this is what
    makes "double-entry" an enforced invariant rather than just a
    convention someone has to remember to follow correctly.

    idempotency_key: if provided and an entry with this key already
    exists, returns the existing entry without creating a duplicate —
    same safety property as the inventory ledger, needed for the same
    reason (retried API calls, resynced offline transactions).
    """
    if idempotency_key:
        existing = JournalEntry.objects.filter(
            idempotency_key=idempotency_key).first()
        if existing:
            return existing

    total_debit = sum(Decimal(str(l.get("debit", 0))) for l in lines)
    total_credit = sum(Decimal(str(l.get("credit", 0))) for l in lines)

    if total_debit != total_credit:
        raise ValueError(
            f"Journal entry is not balanced: debits={total_debit}, credits={total_credit}"
        )

    if total_debit == 0:
        raise ValueError("Journal entry has zero total — nothing to post")

    with transaction.atomic():
        entry = JournalEntry.objects.create(
            branch=branch,
            entry_date=entry_date,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            idempotency_key=idempotency_key or f"{reference_type}:{reference_id}",
            created_by=created_by,
        )
        for line in lines:
            JournalEntryLine.objects.create(
                journal_entry=entry,
                account=line["account"],
                debit=line.get("debit", 0),
                credit=line.get("credit", 0),
            )

    return entry


def get_account_balance(account, branch=None):
    """
    Computed from JournalEntryLine rows — never a stored/mutable balance
    field on Account, for the same reason inventory never stores a
    mutable stock quantity. Asset/Expense accounts increase with debits;
    Liability/Equity/Income accounts increase with credits — this
    function returns the balance in the natural sign for the account's
    type.
    """
    lines = JournalEntryLine.objects.filter(account=account)
    if branch:
        lines = lines.filter(journal_entry__branch=branch)

    totals = lines.aggregate(debit=Sum("debit"), credit=Sum("credit"))
    debit = totals["debit"] or Decimal("0")
    credit = totals["credit"] or Decimal("0")

    if account.account_type in ("asset", "expense"):
        return debit - credit
    return credit - debit
