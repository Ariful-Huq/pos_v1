# backend/apps/catalog/models.py
#
# UPDATED —
# Everything above the "--- NEW FOR E-COMMERCE ---" marker is your original
# code, byte-for-byte, except the three new Product fields marked inline.
# Nothing existing was removed or renamed — POS behavior is unaffected.

from django.db import models
from apps.core.models import BaseModel


class Category(BaseModel):
    """Product categories are org-scoped, not branch-scoped — every branch
    of the same organization sells from the same catalog; only stock
    quantities are branch-specific (that lives in inventory, not here).
    Sub-categories: `parent` makes this self-referential, so a category
    can nest under another (e.g. "Beverages" -> "Cold Drinks"). Any
    category can be a top-level category (parent=null) or a sub-category
    of another — the same model handles both, no separate concept needed."""
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
    from inventory.StockLevel, which is derived from inventory.StockMovement.

    product_type distinguishes a plain single-SKU product from one sold in
    variants (size/color/etc, see ProductVariant below). Simple products
    keep working exactly as before — StockMovement/StockLevel still key off
    Product directly when there's no variant."""
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
    image = models.ImageField(upload_to="products/", null=True, blank=True)
    cost_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(
        max_digits=12, decimal_places=2, default=0)
    tax_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0)  # percent
    is_active = models.BooleanField(default=True)

    # --- NEW for e-commerce, additive only ---
    product_type = models.CharField(
        max_length=20,
        choices=[("simple", "Simple"), ("variant", "Has Variants")],
        default="simple",
    )
    slug = models.SlugField(max_length=220, unique=True, null=True, blank=True)
    is_published_online = models.BooleanField(
        default=False,
        help_text="Gate for the storefront. A product can exist for POS "
        "without appearing online until this is explicitly set.",
    )

    class Meta:
        unique_together = ("organization", "sku")

    def __str__(self):
        return f"{self.sku} — {self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base = slugify(self.name)[:200]
            slug = base
            i = 1
            while Product.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                i += 1
                slug = f"{base}-{i}"
            self.slug = slug
        super().save(*args, **kwargs)


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


# --- NEW FOR E-COMMERCE ---------------------------------------------------

class ProductImage(BaseModel):
    """Extra gallery images. `Product.image` (above) stays the single
    thumbnail used everywhere it already is today (POS grid included);
    this is additive, for the storefront's product detail gallery."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="gallery_images")
    image = models.ImageField(upload_to="products/gallery/")
    alt_text = models.CharField(max_length=255, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order"]


class VariantAttribute(BaseModel):
    """e.g. 'Size', 'Color' — scoped per organization like Category."""
    organization = models.ForeignKey(
        "tenants.Organization", on_delete=models.CASCADE, related_name="variant_attributes"
    )
    name = models.CharField(max_length=100)

    class Meta:
        unique_together = ("organization", "name")

    def __str__(self):
        return self.name


class VariantAttributeValue(BaseModel):
    """e.g. Size -> 'Large', Color -> 'Red'"""
    attribute = models.ForeignKey(
        VariantAttribute, on_delete=models.CASCADE, related_name="values")
    value = models.CharField(max_length=100)

    class Meta:
        unique_together = ("attribute", "value")

    def __str__(self):
        return f"{self.attribute.name}: {self.value}"


class ProductVariant(BaseModel):
    """Only meaningful when Product.product_type == 'variant'. A simple
    product has zero rows here, and inventory keeps keying stock off
    Product directly (StockMovement.variant is null) exactly like today."""
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, blank=True)
    price_override = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True)
    attribute_values = models.ManyToManyField(
        VariantAttributeValue, related_name="variants")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.sku

    @property
    def effective_price(self):
        return self.price_override if self.price_override is not None else self.product.selling_price
