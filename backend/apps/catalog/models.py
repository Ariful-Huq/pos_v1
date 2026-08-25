# backend/apps/catalog/models.py

from django.db import models
from apps.core.models import BaseModel


class Category(BaseModel):
    """Product categories are org-scoped, not branch-scoped — every branch
    of the same organization sells from the same catalog; only stock
    quantities are branch-specific (that lives in inventory, not here)."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=150)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.CASCADE, related_name="children"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class UnitOfMeasure(BaseModel):
    """e.g. pcs, kg, ltr, box. Shared across all organizations — units
    themselves aren't org-specific, only how a product uses them is."""
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.code


class Product(BaseModel):
    """The sellable item definition. Does NOT hold a stock quantity field —
    that would violate the ledger rule. Current stock per branch is read
    from inventory.StockLevel, which is derived from inventory.StockMovement."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="products"
    )
    category = models.ForeignKey(
        Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="products"
    )
    base_unit = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT)
    sku = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    cost_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0)  # percent
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("organization", "sku")

    def __str__(self):
        return f"{self.sku} — {self.name}"


class ProductBarcode(BaseModel):
    """A product can have multiple barcodes for different packaging levels
    (e.g. a single-piece barcode and a box-of-12 barcode). conversion_factor
    says how many base_units one scan of this barcode represents — this is
    what makes 'scan the box, sell 12 pieces' work correctly against stock."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="barcodes")
    barcode = models.CharField(max_length=64, unique=True)
    unit = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT)
    conversion_factor = models.DecimalField(
        max_digits=10, decimal_places=3, default=1)
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.barcode} ({self.product.sku})"
