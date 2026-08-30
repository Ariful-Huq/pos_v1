# backend\apps\authz\management\commands\seed_authz.py

from django.core.management.base import BaseCommand
from apps.authz.models import Feature, Role, RoleFeature

# Starter feature set — extend as sales/inventory/etc. apps get built.
# Convention: "<module>.<action>"
FEATURES = [
    ("sales.view", "sales", "View sales"),
    ("sales.create", "sales", "Create sale"),
    ("sales.void", "sales", "Void/cancel sale"),
    ("inventory.view", "inventory", "View inventory"),
    ("inventory.adjust", "inventory", "Adjust stock"),
    ("purchases.view", "purchases", "View purchases"),
    ("purchases.create", "purchases", "Create purchase order"),
    ("expenses.view", "expenses", "View expenses"),
    ("expenses.create", "expenses", "Create expense"),
    ("reports.view_financial", "reports", "View financial reports"),
    ("staff.manage", "staff", "Manage staff"),
    ("catalog.view", "catalog", "View products/catalog"),
    ("catalog.manage", "catalog", "Create/edit products"),
    ("settings.manage", "settings", "Manage business profile and branches"),
]

ROLES = {
    "owner": [code for code, _, _ in FEATURES],  # everything, for now
    "branch_manager": [
        "sales.view", "sales.create", "sales.void",
        "inventory.view", "inventory.adjust",
        "purchases.view", "purchases.create",
        "expenses.view", "expenses.create",
        "reports.view_financial", "catalog.view", "catalog.manage",
    ],
    "cashier": [
        "sales.view", "sales.create", "inventory.view",
        "catalog.view", "catalog.manage",
    ],
}


class Command(BaseCommand):
    help = "Seed baseline Feature and Role data for the authz app"

    def handle(self, *args, **options):
        feature_objs = {}
        for code, module, label in FEATURES:
            feature, _ = Feature.objects.get_or_create(
                code=code, defaults={"module": module, "label": label}
            )
            feature_objs[code] = feature
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {len(feature_objs)} features"))

        for role_code, feature_codes in ROLES.items():
            role, _ = Role.objects.get_or_create(
                code=role_code,
                defaults={"name": role_code.replace(
                    "_", " ").title(), "is_system": True},
            )
            for fc in feature_codes:
                RoleFeature.objects.get_or_create(
                    role=role, feature=feature_objs[fc])
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(ROLES)} roles"))
