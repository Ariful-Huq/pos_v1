# backend/apps/catalog/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from apps.core.pagination import StandardResultsSetPagination
from .models import Product, Category, UnitOfMeasure
from .serializers import ProductSerializer, CategorySerializer, UnitOfMeasureSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """
    /api/catalog/products/

    NOTE: not yet filtered by the user's organization — every product is
    visible regardless of which org owns it. Fine for now with a single
    test organization; revisit before onboarding a second organization.
    """
    queryset = Product.objects.select_related(
        "category", "base_unit").prefetch_related("barcodes").order_by("name")
    serializer_class = ProductSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "catalog.view"
        return "catalog.manage"

    def get_queryset(self):
        """
        Supports the POS catalog picker's ?search= and ?category= query
        params. search matches name or SKU (case-insensitive, partial);
        category filters to an exact Category id.
        """
        qs = super().get_queryset()

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search)
                           | Q(sku__icontains=search))

        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)

        return qs

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """
        GET /api/catalog/products/lookup/?code=<barcode-or-sku>

        Used by the POS checkout screen: a barcode scanner types the code
        followed by Enter, or a cashier types a SKU manually. Matches
        against ProductBarcode.barcode first (exact), then falls back to
        Product.sku (case-insensitive) so typing a SKU manually also works.
        """
        code = request.query_params.get("code", "").strip()
        if not code:
            return Response({"detail": "code is required"}, status=status.HTTP_400_BAD_REQUEST)

        product = Product.objects.filter(barcodes__barcode=code).select_related(
            "category", "base_unit"
        ).prefetch_related("barcodes").first()

        if not product:
            product = Product.objects.filter(sku__iexact=code).select_related(
                "category", "base_unit"
            ).prefetch_related("barcodes").first()

        if not product:
            return Response({"detail": "No product matches this code"}, status=status.HTTP_404_NOT_FOUND)

        return Response(ProductSerializer(product).data)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by("name")
    serializer_class = CategorySerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "catalog.view"
        return "catalog.manage"


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all().order_by("code")
    serializer_class = UnitOfMeasureSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "catalog.view"
        return "catalog.manage"
