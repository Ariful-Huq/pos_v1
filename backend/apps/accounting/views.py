# backend/apps/accounting/views.py

from rest_framework import viewsets
from apps.core.pagination import StandardResultsSetPagination
from .models import Account, JournalEntry
from .serializers import AccountSerializer, JournalEntrySerializer


class AccountViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/accounting/accounts/

    Read-only for now — accounts are managed via seed_accounting or the
    Django admin; no API-driven "add account" flow yet. Posting entries
    (JournalEntry/JournalEntryLine) from sales/purchases/expenses is a
    separate, deliberately-not-yet-built integration — see project notes
    on the FIFO vs weighted-average decision this depends on.
    """
    queryset = Account.objects.all().order_by("code")
    serializer_class = AccountSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        return "reports.view_financial"


class JournalEntryViewSet(viewsets.ReadOnlyModelViewSet):
    """/api/accounting/journal-entries/ — read-only ledger view."""
    queryset = JournalEntry.objects.prefetch_related("lines__account").select_related(
        "branch").order_by("-entry_date", "-created_at")
    serializer_class = JournalEntrySerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        return "reports.view_financial"
