"""
apps/ecommerce/views.py

Customer auth uses a signed token (django.core.signing), not
djangorestframework-simplejwt — simplejwt in this project is wired to
Django's auth.User (staff login via /api/auth/token/), and CustomerAccount
is deliberately not auth.User. This keeps the two identity systems from
ever touching each other.

IMPORTANT: every view below sets `authentication_classes =
[CustomerTokenAuthentication]`, overriding the project-wide default of
JWTAuthentication (see config/settings.py REST_FRAMEWORK). Without this,
JWTAuthentication would try to decode a customer's signed token as a staff
JWT on every request — including guest/AllowAny ones — and raise before
the AllowAny permission is ever checked. This is not optional boilerplate.

Org/branch resolution is deliberately simple for now: this storefront is
single-organization, single-fulfillment-branch (ECOMMERCE_ORGANIZATION_ID /
ECOMMERCE_FULFILLMENT_BRANCH_ID in settings — see ecommerce SSOT §1). If
you later support multiple organizations/storefronts, replace
get_current_organization() with real request-based resolution (subdomain,
header, etc.) — nothing else in this file needs to change, callers already
go through this one function.
"""
from django.conf import settings
from django.core import signing
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product, Category
from apps.catalog.serializers import ProductPublicSerializer
from apps.tenants.models import Branch, Organization

from . import services
from .models import Address, Cart, CustomerAccount, Order
from .serializers import (
    AddressSerializer, CartSerializer, CategoryPublicSerializer, CheckoutSerializer,
    CustomerAccountSerializer, CustomerLoginSerializer, CustomerRegisterSerializer, OrderSerializer,
)

SIGNING_SALT = "ecommerce.customer-auth"
TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 14  # 14 days


def issue_customer_token(customer: CustomerAccount) -> str:
    return signing.dumps({"customer_id": str(customer.id)}, salt=SIGNING_SALT)


class CustomerTokenAuthentication(BaseAuthentication):
    """Reads `Authorization: Bearer <signed-token>`. Returns None (not an
    exception) when the header is absent, so guest/AllowAny requests pass
    through untouched — only a *present but invalid* token raises."""

    def authenticate(self, request):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.removeprefix("Bearer ").strip()
        try:
            data = signing.loads(token, salt=SIGNING_SALT,
                                 max_age=TOKEN_MAX_AGE_SECONDS)
        except signing.BadSignature:
            raise AuthenticationFailed("Invalid or expired token.")
        try:
            customer = CustomerAccount.objects.get(
                id=data["customer_id"], is_active=True)
        except CustomerAccount.DoesNotExist:
            raise AuthenticationFailed("Customer not found.")
        return (customer, None)


def get_current_organization() -> Organization:
    if not settings.ECOMMERCE_ORGANIZATION_ID:
        raise RuntimeError(
            "ECOMMERCE_ORGANIZATION_ID is not set in settings/.env")
    return get_object_or_404(Organization, id=settings.ECOMMERCE_ORGANIZATION_ID)


def get_fulfillment_branch() -> Branch:
    if not settings.ECOMMERCE_FULFILLMENT_BRANCH_ID:
        raise RuntimeError(
            "ECOMMERCE_FULFILLMENT_BRANCH_ID is not set in settings/.env")
    return get_object_or_404(Branch, id=settings.ECOMMERCE_FULFILLMENT_BRANCH_ID)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class RegisterView(generics.CreateAPIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]
    serializer_class = CustomerRegisterSerializer

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        customer = CustomerAccount.objects.get(email=response.data["email"])
        response.data["token"] = issue_customer_token(customer)
        return response

    def perform_create(self, serializer):
        serializer.save(organization=get_current_organization())


class LoginView(APIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CustomerLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer = CustomerAccount.objects.filter(
            email=serializer.validated_data["email"], is_active=True
        ).first()
        if not customer or not customer.check_password(serializer.validated_data["password"]):
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response({"token": issue_customer_token(customer)})


class MeView(generics.RetrieveAPIView):
    """GET /auth/me/ — the signed-in customer's own profile. There's no
    logout endpoint: the token is stateless (django.core.signing, not a
    DB-backed session), so "logging out" is just deleting it client-side.
    Nothing server-side needs to know."""
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerAccountSerializer

    def get_object(self):
        return self.request.user


# ---------------------------------------------------------------------------
# Public catalog (published-online products only)
# ---------------------------------------------------------------------------
class ProductListView(generics.ListAPIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductPublicSerializer

    def get_queryset(self):
        qs = Product.objects.filter(is_published_online=True, is_active=True)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category_id=category)
        min_price = self.request.query_params.get("min_price")
        if min_price:
            qs = qs.filter(selling_price__gte=min_price)
        max_price = self.request.query_params.get("max_price")
        if max_price:
            qs = qs.filter(selling_price__lte=max_price)
        ordering = self.request.query_params.get("ordering")
        ordering_map = {
            "latest": "-created_at",
            "price_asc": "selling_price",
            "price_desc": "-selling_price",
            "name_asc": "name",
        }
        qs = qs.order_by(ordering_map.get(ordering, "-created_at"))
        return qs


class CategoryListView(generics.ListAPIView):
    """Public, read-only. Deliberately separate from apps.catalog's own
    Category endpoint (that one's behind HasFeaturePermission for staff) —
    this returns only active categories for the storefront's organization,
    no auth required, minimal shape (see CategoryPublicSerializer)."""
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]
    serializer_class = CategoryPublicSerializer

    def get_queryset(self):
        return Category.objects.filter(
            organization=get_current_organization(), is_active=True
        ).order_by("name")


class ProductDetailView(generics.RetrieveAPIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]
    serializer_class = ProductPublicSerializer
    queryset = Product.objects.filter(is_published_online=True, is_active=True)
    lookup_field = "slug"


# ---------------------------------------------------------------------------
# Cart — works for guest (session-keyed) or authenticated customer
# ---------------------------------------------------------------------------
def _get_or_create_cart(request) -> Cart:
    organization = get_current_organization()
    customer = request.user if isinstance(
        getattr(request, "user", None), CustomerAccount) else None
    if customer:
        cart, _ = Cart.objects.get_or_create(
            customer=customer, status="active", organization=organization
        )
        return cart
    if not request.session.session_key:
        request.session.create()
    session_key = request.session.session_key
    cart, _ = Cart.objects.get_or_create(
        session_key=session_key, status="active", customer=None, organization=organization
    )
    return cart


class CartView(APIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        cart = _get_or_create_cart(request)
        return Response(CartSerializer(cart).data)

    def post(self, request):
        cart = _get_or_create_cart(request)
        product = get_object_or_404(Product, id=request.data.get(
            "product"), is_published_online=True)
        variant_id = request.data.get("variant")
        variant = get_object_or_404(
            product.variants, id=variant_id) if variant_id else None
        quantity = int(request.data.get("quantity", 1))
        unit_price = variant.effective_price if variant else product.selling_price
        services.add_to_cart(cart, product, variant, quantity, unit_price)
        return Response(CartSerializer(cart).data, status=status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]

    def patch(self, request, item_id):
        from .models import CartItem
        item = get_object_or_404(CartItem, id=item_id)
        quantity = int(request.data.get("quantity", 0))
        services.update_cart_item_quantity(item, quantity)
        remaining_cart = Cart.objects.get(pk=item.cart_id)
        return Response(CartSerializer(remaining_cart).data)

    def delete(self, request, item_id):
        from .models import CartItem
        item = get_object_or_404(CartItem, id=item_id)
        cart = item.cart
        item.delete()
        return Response(CartSerializer(cart).data)


# ---------------------------------------------------------------------------
# Checkout
# ---------------------------------------------------------------------------
class CheckoutView(APIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cart = _get_or_create_cart(request)
        customer = request.user if isinstance(
            getattr(request, "user", None), CustomerAccount) else None

        if data.get("shipping_address_id"):
            address = get_object_or_404(
                Address, id=data["shipping_address_id"])
        else:
            address = Address.objects.create(
                customer=customer, **data["shipping_address"])

        try:
            order = services.checkout(
                cart=cart,
                shipping_address=address,
                payment_method=data["payment_method"],
                organization=get_current_organization(),
                fulfillment_branch=get_fulfillment_branch(),
                customer=customer,
                guest_email=data.get("guest_email", ""),
                guest_phone=data.get("guest_phone", ""),
                idempotency_key=data.get("idempotency_key") or None,
            )
        except services.CheckoutError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Order history (auth required)
# ---------------------------------------------------------------------------
class OrderListView(generics.ListAPIView):
    authentication_classes = [CustomerTokenAuthentication]
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return Order.objects.filter(customer=self.request.user).order_by("-created_at")


class OrderDetailView(generics.RetrieveAPIView):
    authentication_classes = [CustomerTokenAuthentication]
    # guest can view their own order by id (no listing)
    permission_classes = [permissions.AllowAny]
    serializer_class = OrderSerializer
    queryset = Order.objects.all()
