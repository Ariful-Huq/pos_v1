from rest_framework import serializers

from .models import Address, Cart, CartItem, CustomerAccount, HomeBanner, Order, OrderItem, Payment


class HomeBannerPublicSerializer(serializers.ModelSerializer):
    """Public shape for the home page — no organization/is_active/schedule
    fields; the queryset (HomeBannerListView) already filters to only the
    banners that should be visible right now."""
    class Meta:
        model = HomeBanner
        fields = ["id", "title", "subtitle", "image", "cta_label", "cta_url"]


class CustomerRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Optional — the register form offers a single "Address" field (not the
    # full line1/line2/city breakdown checkout uses). When provided, it
    # becomes the customer's default Address (as line1), ready to prefill
    # checkout later. Write-only: not a CustomerAccount model field.
    address = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = CustomerAccount
        fields = ["id", "email", "full_name", "phone", "password", "address"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        address_text = validated_data.pop("address", "").strip()
        customer = CustomerAccount(**validated_data)
        customer.set_password(password)
        customer.save()
        if address_text:
            Address.objects.create(
                customer=customer,
                full_name=customer.full_name,
                phone=customer.phone,
                line1=address_text,
                city="",
                is_default=True,
            )
        return customer


class CustomerLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class OrderTrackSerializer(serializers.Serializer):
    """Deliberately requires BOTH order_number and a contact value —
    order_number alone would let anyone who saw a receipt/box guess at
    other people's orders by trying sequential-looking numbers. Matching
    against the actual contact info on file is the real guard here."""
    order_number = serializers.CharField()
    contact = serializers.CharField(help_text="Email or phone used at checkout")


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ["id", "label", "full_name", "phone", "line1", "line2", "city", "area", "is_default"]


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    # Real — Product.tax_rate already exists, just unused until now. Lets
    # the cart page show an accurate tax estimate before an Order exists.
    tax_rate = serializers.DecimalField(source="product.tax_rate", max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = CartItem
        fields = ["id", "product", "product_name", "variant", "quantity", "unit_price_snapshot", "tax_rate"]
        read_only_fields = ["unit_price_snapshot"]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ["id", "status", "items", "total"]

    def get_total(self, obj):
        return sum((i.unit_price_snapshot * i.quantity for i in obj.items.all()), 0)


class CheckoutSerializer(serializers.Serializer):
    # Either pass shipping_address_id (a saved address, e.g. a logged-in
    # customer picking one from their account) OR shipping_address (inline
    # dict, the guest-checkout path — one step, no separate "save address
    # first" round trip).
    shipping_address_id = serializers.UUIDField(required=False)
    shipping_address = AddressSerializer(required=False)
    payment_method = serializers.ChoiceField(choices=["cod", "bkash", "nagad", "card"])
    guest_email = serializers.EmailField(required=False, allow_blank=True)
    guest_phone = serializers.CharField(required=False, allow_blank=True)
    idempotency_key = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if not data.get("shipping_address_id") and not data.get("shipping_address"):
            raise serializers.ValidationError(
                "Provide either shipping_address_id or shipping_address."
            )
        return data


class OrderItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    line_tax = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            "id", "product", "variant", "product_name_snapshot", "unit_price_snapshot",
            "tax_rate_snapshot", "quantity", "line_total", "line_tax",
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["id", "method", "status", "amount", "provider_reference"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    shipping_address = AddressSerializer(read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "subtotal", "shipping_cost", "tax_amount", "total",
            "guest_email", "guest_phone", "shipping_address", "items", "payments", "created_at",
        ]


class CategoryPublicSerializer(serializers.Serializer):
    """Deliberately not a ModelSerializer against apps.catalog.serializers'
    CategorySerializer — that one exposes `organization` (fine internally,
    unnecessary on a public endpoint). Minimal public shape instead."""
    id = serializers.UUIDField()
    name = serializers.CharField()
    parent = serializers.UUIDField(source="parent_id", allow_null=True)


class OrganizationPublicSerializer(serializers.Serializer):
    """Public storefront branding — name/logo/contact only. Deliberately
    excludes legal_name and is_active, which are internal/staff concerns.
    Not a ModelSerializer against apps.tenants' Organization for the same
    reason as CategoryPublicSerializer above: avoid coupling this public
    shape to whatever fields that model happens to have."""
    name = serializers.CharField()
    logo = serializers.ImageField(allow_null=True)
    contact_email = serializers.EmailField(allow_blank=True)
    contact_phone = serializers.CharField(allow_blank=True)


class CustomerAccountSerializer(serializers.ModelSerializer):
    """Read-only self-profile, returned by GET /auth/me/. Mirrors the
    staff-side /api/authz/me/ pattern already used elsewhere in this
    project — same idea, separate identity system (CustomerAccount, not
    auth.User), so it lives here rather than in apps.authz."""
    class Meta:
        model = CustomerAccount
        fields = ["id", "email", "full_name", "phone"]
