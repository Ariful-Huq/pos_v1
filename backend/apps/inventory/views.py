# backend/apps/inventory/views.py

import uuid
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.pagination import StandardResultsSetPagination
from apps.catalog.models import Product
from apps.tenants.models import Branch
from .models import StockLevel, StockMovement
from .serializers import StockLevelSerializer, StockMovementSerializer
from . import services


def get_active_branch(request):
    """Unlike sales/purchases, this does NOT fall back to the first
    Branch when the header is missing — for inventory, 'no branch
    selected' legitimately means 'show stock across all branches',
    which is a reasonable overview for an owner/superuser."""
    branch_id = request.headers.get("X-Active-Branch")
    if branch_id:
        return Branch.objects.filter(id=branch_id).first()
    return None


class StockLevelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/inventory/stock-levels/

    Read-only by design — the only way stock quantity ever changes is
    through apps.inventory.services.record_movement() (via sales,
    purchases, or the /adjust/ action below), never by editing a
    StockLevel row directly. See StockLevel's model docstring.
    """
    serializer_class = StockLevelSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if self.action == "adjust":
            return "inventory.adjust"
        return "inventory.view"

    def get_queryset(self):
        qs = StockLevel.objects.select_related(
            "product", "branch").order_by("product__name")
        branch = get_active_branch(self.request)
        if branch:
            qs = qs.filter(branch=branch)
        return qs

    @action(detail=False, methods=["post"], url_path="adjust")
    def adjust(self, request):
        """
        POST /api/inventory/stock-levels/adjust/  { product, quantity, notes? }

        quantity is SIGNED — positive to add stock (e.g. found extra
        units during a count), negative to remove it (e.g. damage,
        shrinkage). Goes through the same ledger as every other stock
        change, with a freshly generated idempotency key since a manual
        adjustment has no natural originating event to key off of.
        """
        product = Product.objects.filter(
            id=request.data.get("product")).first()
        branch = get_active_branch(request) or Branch.objects.first()
        if not product or not branch:
            return Response({"detail": "product and an active branch are required"}, status=400)

        try:
            services.record_movement(
                product=product,
                branch=branch,
                movement_type="adjustment",
                quantity=request.data.get("quantity"),
                idempotency_key=f"manual-adjust:{uuid.uuid4()}",
                notes=request.data.get("notes", ""),
                created_by=request.user,
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        new_quantity = services.get_stock_level(product, branch)
        return Response({"product": str(product.id), "branch": str(branch.id), "quantity": new_quantity})


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    /api/inventory/movements/?product=<id>

    Read-only history view — the ledger itself. Filterable by product so
    the frontend can show "movement history" for one item.
    """
    serializer_class = StockMovementSerializer
    pagination_class = StandardResultsSetPagination
    queryset = StockMovement.objects.select_related(
        "product", "branch", "created_by").order_by("-created_at")

    def get_required_feature(self, request, view):
        return "inventory.view"

    def get_queryset(self):
        qs = super().get_queryset()
        product_id = self.request.query_params.get("product")
        if product_id:
            qs = qs.filter(product_id=product_id)
        branch = get_active_branch(self.request)
        if branch:
            qs = qs.filter(branch=branch)
        return qs
