# backend/apps/sales/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from apps.core.pagination import StandardResultsSetPagination
from apps.tenants.models import Branch, Organization
from apps.catalog.models import Product
from .models import Sale, SaleItem, Customer
from .serializers import SaleSerializer, CustomerSerializer, CustomerSaleHistorySerializer
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


def resolve_organization(request):
    """Same pattern as apps.catalog.views.resolve_organization — the
    organization a newly-created Customer belongs to is inferred from the
    active branch, never taken from the client."""
    branch = get_active_branch(request)
    if branch:
        return branch.organization
    return Organization.objects.first()


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

    @action(detail=True, methods=["post"], url_path="customer")
    def set_customer(self, request, pk=None):
        """POST /api/sales/sales/{id}/customer/  { customer: <id> | null }

        Attaches (or clears, with customer: null) the customer on a draft
        sale. This is separate from create() because the POS starts a
        draft sale immediately on screen-load — before a cashier has had
        a chance to open the customer picker — so the customer is very
        often chosen or changed after the sale already exists. Only
        allowed while the sale is still a draft: once completed, the sale
        has already been receipted (see sale_number / price snapshots in
        the design doc) and shouldn't silently change who it was for.
        """
        sale = self.get_object()
        if sale.status != "draft":
            return Response(
                {"detail": "Cannot change the customer on a sale that is not in draft status"},
                status=400,
            )

        customer_id = request.data.get("customer")
        if customer_id:
            customer = Customer.objects.filter(id=customer_id).first()
            if not customer:
                return Response({"detail": "Customer not found"}, status=404)
            sale.customer = customer
        else:
            sale.customer = None
        sale.save(update_fields=["customer"])

        sale.refresh_from_db()
        return Response(SaleSerializer(sale).data)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    /api/sales/customers/

    A plain CRUD resource (unlike Sale) — Customer has no lifecycle of
    its own. Kept lightweight to match the model's own docstring: this is
    contact info + a loyalty-points counter, not a rewards engine.

    NOTE: not yet filtered by organization, same as ProductViewSet and
    SupplierViewSet — fine with a single test organization, revisit
    before onboarding a second one.
    """
    queryset = Customer.objects.all().order_by("name")
    serializer_class = CustomerSerializer
    pagination_class = StandardResultsSetPagination

    def get_required_feature(self, request, view):
        if self.action == "sales":
            return "sales.view"  # exposes sale history, not customer data
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return "customers.view"
        return "customers.manage"

    def get_queryset(self):
        """Supports the POS customer picker's ?search= — matches name or
        phone, case-insensitive, partial (mirrors ProductViewSet's
        ?search= for the catalog picker)."""
        qs = self.queryset
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(phone__icontains=search))
        return qs

    def perform_create(self, serializer):
        if not serializer.validated_data.get("organization"):
            serializer.save(organization=resolve_organization(self.request))
        else:
            serializer.save()

    @action(detail=True, methods=["get"], url_path="sales")
    def sales(self, request, pk=None):
        """GET /api/sales/customers/{id}/sales/ — this customer's own
        sale history for the POS 'purchase history' panel. Most recent
        first; capped rather than paginated since this is a quick
        lookup panel, not a full sales report (apps.reports covers that)."""
        customer = self.get_object()
        qs = customer.sales.exclude(status="draft").order_by("-created_at")[:50]
        return Response(CustomerSaleHistorySerializer(qs, many=True).data)