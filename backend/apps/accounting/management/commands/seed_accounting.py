# backend/apps/accounting/management/commands/seed_accounting.py

from django.core.management.base import BaseCommand
from apps.tenants.models import Organization
from apps.accounting.models import Account

# A minimal starter chart of accounts — extend as needed once real
# reporting requirements (P&L, balance sheet) are worked out.
ACCOUNTS = [
    ("1000", "Cash", "asset"),
    ("1010", "Bank", "asset"),
    ("1020", "Mobile Banking", "asset"),
    ("1100", "Accounts Receivable", "asset"),
    ("1200", "Inventory Asset", "asset"),
    ("2000", "Accounts Payable", "liability"),
    ("3000", "Owner's Equity", "equity"),
    ("4000", "Sales Revenue", "income"),
    ("4100", "Sales Returns", "income"),
    ("5000", "Cost of Goods Sold", "expense"),
    ("5100", "Rent Expense", "expense"),
    ("5200", "Utilities Expense", "expense"),
    ("5300", "General Expense", "expense"),
]


class Command(BaseCommand):
    help = "Seed a starter chart of accounts for an organization"

    def add_arguments(self, parser):
        parser.add_argument(
            "--organization", type=str, default=None,
            help="Organization name to seed accounts for. Defaults to the first Organization found."
        )

    def handle(self, *args, **options):
        org_name = options.get("organization")
        organization = (
            Organization.objects.filter(name=org_name).first()
            if org_name else Organization.objects.first()
        )

        if not organization:
            self.stdout.write(self.style.ERROR(
                "No Organization found — create one first."))
            return

        created_count = 0
        for code, name, account_type in ACCOUNTS:
            _, created = Account.objects.get_or_create(
                organization=organization,
                code=code,
                defaults={"name": name, "account_type": account_type},
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {created_count} accounts for '{organization.name}'")
        )
