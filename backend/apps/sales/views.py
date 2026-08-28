# backend/apps/sales/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.pagination import StandardResultsSetPagination
from apps.tenants.models import Branch
from apps.catalog.models import Product
from .models import Sale, SaleItem
from .serializers import SaleSerializer
from . import services

# Maps DRF viewset action names to the feature code each one requires.
# Anything not listed here falls back to "sales.view" for GET-like access
# and "sales.create" otherwise — see get_required_feature below.
ACTION_FEATURE_MAP = {
    "void": "sales.void",
}


def get_active_branch(request):
    """
    Resolves the branch a sale should be created against, from the
    X-Active-Branch header. Falls back to the first Branch in the
    database for single-branch local dev convenience — remove this
    fallback once real branch assignment (UserBranchRole) is in place
    for every user, since at that point a missing header should be a
    hard error, not silently guessed.
    """
    branch_id = request.headers.get("X-Active-Branch")
    if branch_id:
        branch = Branch.objects.filter(id=branch_id).first()
        if branch:
            return branch
    return Branch.objects.first()


class SaleViewSet(viewsets.ModelViewSet):
    """
    /api/sales/sales/

    Deliberately NOT a plain CRUD resource — a Sale has a real lifecycle
    (draft -> completed -> void/refunded) enforced by apps.sales.services,
    so creation and every state transition go through dedicated actions
    that call those service functions, rather than generic create/update.
    """
    queryset = Sale.objects.prefetch_related("items", "payments").select_related("customer").order_by("-created_at")
    serializer_class = SaleSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        qs = self.queryset
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        branch = get_active_branch(self.request)
        if branch:
            qs = qs.filter(branch=branch)
        return qs

    def get_required_feature(self, request, view):
        if self.action in ACTION_FEATURE_MAP:
            return ACTION_FEATURE_MAP[self.action]
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "sales.view"
        return "sales.create"

    def create(self, request, *args, **kwargs):
        """Starts a new draft sale (an empty held cart) against the
        active branch. customer is optional (walk-in by default)."""
        branch = get_active_branch(request)
        if not branch:
            return Response({"detail": "No branch available — create a Branch first."}, status=400)

        sale = services.create_draft_sale(branch=branch, created_by=request.user)

        customer_id = request.data.get("customer")
        if customer_id:
            sale.customer_id = customer_id
            sale.save(update_fields=["customer"])

        return Response(SaleSerializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="items")
    def add_item(self, request, pk=None):
        """POST /api/sales/sales/{id}/items/  { product, quantity, unit_price? }"""
        sale = self.get_object()
        product = Product.objects.filter(id=request.data.get("product")).first()
        if not product:
            return Response({"detail": "Product not found"}, status=404)

        try:
            services.add_item(
                sale=sale,
                product=product,
                quantity=request.data.get("quantity", 1),
                unit_price=request.data.get("unit_price"),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["post"], url_path="items/(?P<item_id>[^/.]+)/remove")
    def remove_item(self, request, pk=None, item_id=None):
        sale = self.get_object()
        item = SaleItem.objects.filter(id=item_id, sale=sale).first()
        if not item:
            return Response({"detail": "Line item not found"}, status=404)

        try:
            services.remove_item(sale, item)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["post"], url_path="items/(?P<item_id>[^/.]+)/quantity")
    def update_item_quantity(self, request, pk=None, item_id=None):
        sale = self.get_object()
        item = SaleItem.objects.filter(id=item_id, sale=sale).first()
        if not item:
            return Response({"detail": "Line item not found"}, status=404)

        try:
            services.update_item_quantity(sale, item, request.data.get("quantity"))
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """POST /api/sales/sales/{id}/complete/  { payments: [{method, amount, reference?}] }"""
        sale = self.get_object()
        payments = request.data.get("payments", [])

        try:
            services.complete_sale(sale, payments=payments, completed_by=request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data)

    @action(detail=True, methods=["post"], url_path="void")
    def void(self, request, pk=None):
        sale = self.get_object()
        try:
            services.void_sale(sale, reason=request.data.get("reason", ""), voided_by=request.user)
        except ValueError as e:
            return Response({"detail": str(e)}, status=400)

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data)