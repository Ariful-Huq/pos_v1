# backend/apps/purchases/views.py

import uuid
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.pagination import StandardResultsSetPagination
from apps.tenants.models import Branch
from .models import Supplier, PurchaseOrder, PurchaseOrderItem
from .serializers import SupplierSerializer, PurchaseOrderSerializer
from . import services


def get_active_branch(request):
    """Same pattern as sales.views.get_active_branch — resolves from
    X-Active-Branch, falling back to the first Branch for single-branch
    local dev. See that function's docstring for the caveat."""
    branch_id = request.headers.get("X-Active-Branch")
    if branch_id:
        branch = Branch.objects.filter(id=branch_id).first()
        if branch:
            return branch
    return Branch.objects.first()


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by("name")
    serializer_class = SupplierSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "purchases.view"
        return "purchases.create"


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.prefetch_related(
        "items").select_related("supplier", "branch").order_by("-created_at")
    serializer_class = PurchaseOrderSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if self.action == "receive_item":
            return "purchases.create"  # receiving is a write action too
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "purchases.view"
        return "purchases.create"

    def perform_create(self, serializer):
        extra = {}
        if not serializer.validated_data.get("branch"):
            extra["branch"] = get_active_branch(self.request)
        if not serializer.validated_data.get("reference_number"):
            extra["reference_number"] = f"PO-{uuid.uuid4().hex[:8].upper()}"
        serializer.save(**extra)

    @action(detail=True, methods=["post"], url_path="items/(?P<item_id>[^/.]+)/receive")
    def receive_item(self, request, pk=None, item_id=None):
        """POST /api/purchases/purchase-orders/{id}/items/{item_id}/receive/  { quantity }"""
        purchase_order = self.get_object()
        item = PurchaseOrderItem.objects.filter(
            id=item_id, purchase_order=purchase_order).first()
        if not item:
            return Response({"detail": "Line item not found"}, status=404)

        quantity = request.data.get("quantity")
        try:
            services.receive_purchase_order_item(
                item, quantity, received_by=request.user)
        except Exception as e:
            return Response({"detail": str(e)}, status=400)

        purchase_order.refresh_from_db()
        return Response(PurchaseOrderSerializer(purchase_order).data)
